import { createHash } from "node:crypto";
import {
  parsePurchaseInput,
  parseSupplierInput,
  parseSupplierPayment,
  type PurchaseReceipt,
  type Supplier,
  type SupplierActivity,
  type SupplierPayment,
} from "@mizan/contracts";
import { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import {
  resolveAccessContext,
  type AccessContext,
} from "../access/access.service.js";
import { canManageAsOwner } from "../access/display-mode.js";
import {
  lockOrganization,
  type OrganizationDatabase,
} from "../access/organization-owner.js";
import { receiveProduct } from "../products/product.service.js";
import {
  paymentFields,
  presentPayment,
  presentSupplier,
  purchaseAmounts,
  purchaseStatus,
  scopeOf,
  supplierKey,
} from "./supplier.queries.js";

type Tx = Prisma.TransactionClient;

async function ownerWrite<T>(
  db: OrganizationDatabase,
  access: AccessContext,
  work: (tx: Tx, access: AccessContext) => Promise<T>,
  timeout?: number,
) {
  if (!canManageAsOwner(access)) throw new AccessError("ACCESS_DENIED");
  return db.$transaction(
    async (tx) => {
      // Serialize alongside product acquisition, role changes and other supplier writes.
      await lockOrganization(tx, access.organizationId);
      const current = await resolveAccessContext(
        tx,
        access,
        access.organizationId,
        access.storeId,
      );
      if (!canManageAsOwner(current)) throw new AccessError("ACCESS_DENIED");
      return work(tx, current);
    },
    // Reads after waiting on the lock must see the previous committed allocation.
    { timeout, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

function activity(
  tx: Tx,
  access: AccessContext,
  supplierId: string,
  kind: SupplierActivity["kind"],
  purchaseId?: string,
  productCount?: number,
) {
  return tx.supplierActivity.create({
    data: {
      ...scopeOf(access),
      supplierId,
      kind,
      purchaseId,
      productCount,
      actorId: access.userId,
      createdAt: new Date(),
    },
  });
}

export async function saveSupplier(
  db: OrganizationDatabase,
  access: AccessContext,
  body: unknown,
  id?: string,
): Promise<Supplier> {
  const parsed = parseSupplierInput(body, id !== undefined);
  if ("field" in parsed)
    throw new AccessError("INVALID_SUPPLIER", parsed.field);
  const { input } = parsed;
  const phoneDigits =
    input.phone === undefined
      ? undefined
      : (input.phone?.replace(/\D/g, "") ?? null);
  return ownerWrite(db, access, async (tx, current) => {
    if (id === undefined) {
      if (!input.name || input.isActive === false)
        throw new AccessError(
          "INVALID_SUPPLIER",
          !input.name ? "name" : "isActive",
        );
      const row = await tx.supplier.create({
        data: { ...scopeOf(current), ...input, name: input.name, phoneDigits },
      });
      await activity(tx, current, row.id, "CREATED");
      return presentSupplier(row);
    }

    const where = supplierKey(current, id);
    const previous = await tx.supplier.findUnique({ where });
    if (!previous) throw new AccessError("SUPPLIER_NOT_FOUND");
    const stateChanged =
      input.isActive !== undefined && input.isActive !== previous.isActive;
    const { isActive, ...contact } = input;
    const contactChanged = Object.entries(contact).some(
      ([field, value]) => previous[field as keyof typeof contact] !== value,
    );
    if (!stateChanged && !contactChanged) return presentSupplier(previous);

    const row = await tx.supplier.update({
      where,
      data: { ...contact, isActive, phoneDigits },
    });
    if (contactChanged) await activity(tx, current, row.id, "UPDATED");
    if (stateChanged)
      await activity(
        tx,
        current,
        row.id,
        row.isActive ? "REACTIVATED" : "DEACTIVATED",
      );
    return presentSupplier(row);
  });
}

function replayKey(access: AccessContext, idempotencyKey: string) {
  return {
    organizationId_storeId_actorId_idempotencyKey: {
      ...scopeOf(access),
      actorId: access.userId,
      idempotencyKey,
    },
  };
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

// A purchase can contain up to 100 independently valued products.
const ExactDecimal = Prisma.Decimal.clone({ precision: 30 });

export async function registerPurchase(
  db: OrganizationDatabase,
  access: AccessContext,
  body: unknown,
  idempotencyKey: string,
): Promise<PurchaseReceipt> {
  const parsed = parsePurchaseInput(body);
  if ("field" in parsed)
    throw new AccessError("INVALID_PURCHASE", parsed.field);
  const { items, supplierId, purchaseDate, ...metadata } = parsed.input;
  const requestDigest = digest(parsed.input);
  return ownerWrite(
    db,
    access,
    async (tx, current) => {
      const previous = await tx.purchase.findUnique({
        where: replayKey(current, idempotencyKey),
        select: {
          id: true,
          supplierId: true,
          requestDigest: true,
          items: { orderBy: { position: "asc" }, select: { productId: true } },
        },
      });
      if (previous) {
        if (previous.requestDigest !== requestDigest)
          throw new AccessError("SUPPLIER_REQUEST_CONFLICT");
        return {
          id: previous.id,
          supplierId: previous.supplierId,
          productIds: previous.items.map(({ productId }) => productId),
        };
      }

      const supplier = await tx.supplier.findUnique({
        where: supplierKey(current, supplierId),
        select: { id: true, isActive: true },
      });
      if (!supplier) throw new AccessError("SUPPLIER_NOT_FOUND", "supplierId");
      if (!supplier.isActive)
        throw new AccessError("SUPPLIER_INACTIVE", "supplierId");

      const store = scopeOf(current);
      const existingIds = items.flatMap((item) =>
        "productId" in item ? [item.productId] : [],
      );
      const existing = new Map(
        existingIds.length
          ? (
              await tx.product.findMany({
                where: {
                  ...store,
                  id: { in: existingIds },
                  purchaseItem: null,
                },
                select: {
                  id: true,
                  acquisitionCost: true,
                  acquisitionCurrency: true,
                },
              })
            ).map((row) => [row.id, row])
          : [],
      );
      // Validate all links before receiving new stock.
      for (const [position, item] of items.entries()) {
        if (!("productId" in item)) continue;
        const product = existing.get(item.productId);
        if (!product || !product.acquisitionCost.gt(0))
          throw new AccessError(
            "PURCHASE_PRODUCT_CONFLICT",
            `items.${position}`,
          );
        if (product.acquisitionCurrency !== metadata.currency)
          throw new AccessError(
            "SUPPLIER_CURRENCY_MISMATCH",
            `items.${position}.currency`,
          );
      }

      let total = new ExactDecimal(0);
      let received = 0;
      const products = [];
      for (const [position, item] of items.entries()) {
        if ("productId" in item) {
          const cost = existing.get(item.productId)!.acquisitionCost.toFixed();
          total = total.plus(cost);
          products.push({
            position,
            productId: item.productId,
            acquisitionCost: cost,
          });
          continue;
        }
        try {
          const product = await receiveProduct(
            tx,
            current,
            item.product,
            item.total,
          );
          total = total.plus(item.total.amount);
          products.push({
            position,
            productId: product.id,
            acquisitionCost: item.total.amount,
          });
          received++;
        } catch (error) {
          if (error instanceof AccessError && error.field)
            throw new AccessError(
              error.code,
              `items.${position}.${error.field}`,
            );
          throw error;
        }
      }

      const purchase = await tx.purchase.create({
        data: {
          ...store,
          ...metadata,
          supplierId,
          purchaseDate: new Date(purchaseDate),
          actorId: current.userId,
          idempotencyKey,
          requestDigest,
          totalAmount: total.toFixed(),
          items: { createMany: { data: products } },
        },
        select: { id: true, supplierId: true },
      });
      await activity(
        tx,
        current,
        supplierId,
        "PURCHASE_REGISTERED",
        purchase.id,
      );
      if (received)
        await activity(
          tx,
          current,
          supplierId,
          "PRODUCTS_RECEIVED",
          purchase.id,
          received,
        );
      return {
        ...purchase,
        productIds: products.map((item) => item.productId),
      };
    },
    30_000,
  );
}

export async function recordSupplierPayment(
  db: OrganizationDatabase,
  access: AccessContext,
  purchaseId: string,
  body: unknown,
  idempotencyKey: string,
): Promise<SupplierPayment> {
  const parsed = parseSupplierPayment(body);
  if ("field" in parsed)
    throw new AccessError("INVALID_SUPPLIER_PAYMENT", parsed.field);
  purchaseId = purchaseId.toLowerCase();
  const requestDigest = digest({ purchaseId, ...parsed.input });
  return ownerWrite(db, access, async (tx, current) => {
    const previous = await tx.supplierPayment.findUnique({
      where: replayKey(current, idempotencyKey),
      select: { ...paymentFields, requestDigest: true },
    });
    if (previous) {
      if (previous.requestDigest !== requestDigest)
        throw new AccessError("SUPPLIER_REQUEST_CONFLICT");
      return presentPayment(previous);
    }
    const purchase = await purchaseAmounts(tx, current, purchaseId);
    if (parsed.input.currency !== purchase.currency)
      throw new AccessError("SUPPLIER_CURRENCY_MISMATCH", "currency");
    const paymentDate = new Date(parsed.input.paymentDate);
    if (paymentDate < purchase.purchaseDate)
      throw new AccessError("INVALID_SUPPLIER_PAYMENT", "paymentDate");
    const amount = new Prisma.Decimal(parsed.input.amount);
    if (amount.gt(purchase.outstanding))
      throw new AccessError("SUPPLIER_OVERPAYMENT", "amount");

    const payment = await tx.supplierPayment.create({
      data: {
        ...scopeOf(current),
        ...parsed.input,
        paymentDate,
        createdAt: new Date(),
        purchaseId,
        actorId: current.userId,
        idempotencyKey,
        requestDigest,
      },
      select: paymentFields,
    });
    await activity(
      tx,
      current,
      purchase.supplierId,
      "PAYMENT_RECORDED",
      purchaseId,
    );
    const status = amount.eq(purchase.outstanding) ? "PAID" : "PARTIALLY_PAID";
    if (status !== purchaseStatus(purchase))
      await activity(tx, current, purchase.supplierId, status, purchaseId);
    return presentPayment(payment);
  });
}
