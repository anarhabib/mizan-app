import { createHash, randomUUID } from "node:crypto";
import {
  parseProductRegistration,
  type ProductRegistrationReceipt,
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
import { idKey, scopeOf, supplierKey } from "../suppliers/supplier.queries.js";
import {
  writePurchase,
  writeSupplierPayment,
} from "../suppliers/supplier.service.js";
import { receiveProducts } from "./product.service.js";

async function historicalSupplier(
  tx: Prisma.TransactionClient,
  access: AccessContext,
  id: string,
) {
  const supplier = await tx.supplier.findUnique({
    where: supplierKey(access, id),
    select: { id: true, name: true },
  });
  if (!supplier)
    throw new AccessError("SUPPLIER_NOT_FOUND", "historicalSupplierId");
  return supplier;
}

type Tx = Prisma.TransactionClient;

function recordHistoricalLinks(
  tx: Tx,
  access: AccessContext,
  supplierId: string,
  productIds: string[],
) {
  return tx.supplierActivity.createMany({
    data: productIds.map((productId) => ({
      ...scopeOf(access),
      supplierId,
      productId,
      kind: "HISTORICAL_PRODUCT_LINKED",
      actorId: access.userId,
      createdAt: new Date(),
    })),
  });
}

function registrationWrite<T>(
  db: OrganizationDatabase,
  access: AccessContext,
  work: (tx: Tx, current: AccessContext) => Promise<T>,
) {
  return db.$transaction(
    async (tx) => {
      await lockOrganization(tx, access.organizationId);
      const current = await resolveAccessContext(
        tx,
        access,
        access.organizationId,
        access.storeId,
      );
      return work(tx, current);
    },
    {
      timeout: 30_000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );
}

export async function registerProducts(
  db: OrganizationDatabase,
  access: AccessContext,
  body: unknown,
  idempotencyKey: string,
): Promise<ProductRegistrationReceipt> {
  const parsed = parseProductRegistration(body);
  if ("field" in parsed) throw new AccessError("INVALID_PRODUCT", parsed.field);
  const { input } = parsed;
  const requestDigest = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return registrationWrite(db, access, async (tx, current) => {
    if (
      (input.source === "SUPPLIER_PURCHASE" || input.historicalSupplierId) &&
      !canManageAsOwner(current)
    )
      throw new AccessError("ACCESS_DENIED");
    const key = {
      ...scopeOf(current),
      actorId: current.userId,
      idempotencyKey,
    };
    const previous = await tx.productRegistration.findUnique({
      where: { organizationId_storeId_actorId_idempotencyKey: key },
    });
    if (previous) {
      if (previous.requestDigest !== requestDigest)
        throw new AccessError("SUPPLIER_REQUEST_CONFLICT");
      return {
        productIds: previous.productIds,
        purchaseId: previous.purchaseId ?? undefined,
      };
    }

    let receipt: ProductRegistrationReceipt;
    if (input.source === "SUPPLIER_PURCHASE") {
      const purchase = await writePurchase(
        tx,
        current,
        {
          ...input.purchase,
          items: input.products,
        },
        randomUUID(),
      ).catch((error: unknown) => {
        if (error instanceof AccessError && error.field) {
          const field = error.field.startsWith("items.")
            ? error.field.replace(/^items\./, "products.")
            : `purchase.${error.field}`;
          throw new AccessError(error.code, field);
        }
        throw error;
      });
      if (input.initialPayment) {
        try {
          await writeSupplierPayment(
            tx,
            current,
            purchase.id,
            input.initialPayment,
            randomUUID(),
            true,
          );
        } catch (error) {
          if (error instanceof AccessError && error.field)
            throw new AccessError(error.code, `initialPayment.${error.field}`);
          throw error;
        }
      }
      receipt = { productIds: purchase.productIds, purchaseId: purchase.id };
    } else {
      const supplier = input.historicalSupplierId
        ? await historicalSupplier(tx, current, input.historicalSupplierId)
        : undefined;
      const productIds = await receiveProducts(
        tx,
        current,
        input.products,
        input.source,
        supplier,
        (index, field) => `products.${index}.${field}`,
      );
      if (supplier)
        await recordHistoricalLinks(tx, current, supplier.id, productIds);
      receipt = { productIds };
    }
    await tx.productRegistration.create({
      data: { ...key, ...receipt, requestDigest },
    });
    return receipt;
  });
}

export async function linkHistoricalSupplier(
  db: OrganizationDatabase,
  access: AccessContext,
  productId: string,
  supplierId: string,
) {
  return registrationWrite(db, access, async (tx, current) => {
    if (!canManageAsOwner(current)) throw new AccessError("ACCESS_DENIED");
    const where = idKey(current, productId);
    const product = await tx.product.findUnique({
      where,
      select: {
        historicalSupplierId: true,
        purchaseItem: { select: { purchaseId: true } },
      },
    });
    if (!product) throw new AccessError("PRODUCT_NOT_FOUND");
    if (product.historicalSupplierId === supplierId) return;
    if (product.purchaseItem || product.historicalSupplierId)
      throw new AccessError("PRODUCT_EDIT_CONFLICT");
    const supplier = await historicalSupplier(tx, current, supplierId);
    await tx.product.update({
      where,
      data: {
        historicalSupplierId: supplier.id,
        historicalSupplierName: supplier.name,
      },
    });
    await recordHistoricalLinks(tx, current, supplier.id, [productId]);
  });
}
