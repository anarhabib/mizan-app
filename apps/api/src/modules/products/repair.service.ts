import { createHash } from "node:crypto";
import {
  checkoutCurrencies,
  supplierPaymentMethods,
  type ProductGemstone,
  type RepairCommand,
  type RepairDetail,
  type RepairEventKind,
  type RepairHistory,
  type RepairSummary,
} from "@mizan/contracts";
import type { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import {
  actorProfile,
  uuidPattern,
  type AccessContext,
} from "../access/access.service.js";
import { canManageAsOwner } from "../access/display-mode.js";
import type { OrganizationDatabase } from "../access/organization-owner.js";
import { readPageSize } from "../access/page-size.js";
import {
  gemstoneFields,
  presentGemstones,
  presentMoney,
} from "./product.presenter.js";
import { lockProductOwner } from "./product.service.js";

type Tx = Prisma.TransactionClient;
const bakuDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Baku" });
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
const scopeOf = ({ organizationId, storeId }: AccessContext) => ({
  organizationId,
  storeId,
});
const compound = (scope: ReturnType<typeof scopeOf>, id: string) => ({
  organizationId_storeId_id: { ...scope, id },
});
const summaryFields = {
  id: true,
  status: true,
  description: true,
  repairerName: true,
  sentDate: true,
  expectedReturnDate: true,
  completedDate: true,
} as const;

function presentSummary(
  row: Prisma.RepairGetPayload<{ select: typeof summaryFields }>,
): RepairSummary {
  return {
    id: row.id,
    status: row.status,
    description: row.description,
    repairerName: row.repairerName,
    sentDate: dateOnly(row.sentDate),
    expectedReturnDate:
      row.expectedReturnDate && dateOnly(row.expectedReturnDate),
    completedDate: row.completedDate && dateOnly(row.completedDate),
  };
}

export async function listRepairs(
  db: Tx,
  access: AccessContext,
  productId: string,
  { after, limit }: { after?: string; limit?: string },
): Promise<RepairHistory> {
  const scope = scopeOf(access);
  const where = { ...scope, productId };
  const size = readPageSize(limit, "INVALID_REPAIR");
  if (
    !uuidPattern.test(productId) ||
    !(await db.product.findUnique({
      where: compound(scope, productId),
      select: { id: true },
    }))
  )
    throw new AccessError("PRODUCT_NOT_FOUND");
  if (
    after !== undefined &&
    (!uuidPattern.test(after) ||
      !(await db.repair.findFirst({
        where: { ...where, id: after },
        select: { id: true },
      })))
  )
    throw new AccessError("INVALID_REPAIR", "after");
  const rows = await db.repair.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(after && { cursor: compound(scope, after), skip: 1 }),
    take: size + 1,
    select: summaryFields,
  });
  const items = rows.slice(0, size).map(presentSummary);
  return {
    items,
    nextCursor: rows.length > size ? items.at(-1)?.id : undefined,
  };
}

export async function getRepair(
  db: OrganizationDatabase,
  access: AccessContext,
  productId: string,
  id: string,
): Promise<RepairDetail> {
  if (!uuidPattern.test(productId) || !uuidPattern.test(id))
    throw new AccessError("REPAIR_NOT_FOUND");
  const row = await db.$transaction(
    (tx) =>
      tx.repair.findFirst({
        where: { ...scopeOf(access), productId, id },
        include: {
          events: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              kind: true,
              note: true,
              actor: actorProfile,
              createdAt: true,
            },
          },
        },
      }),
    { isolationLevel: "RepeatableRead" },
  );
  if (!row) throw new AccessError("REPAIR_NOT_FOUND");
  const method = supplierPaymentMethods.find(
    (method) => method === row.paymentMethod,
  );
  return {
    ...presentSummary(row),
    before: {
      weight: row.beforeWeight.toFixed(3),
      netGoldWeight: row.beforeNetWeight?.toFixed(3) ?? null,
      gemstones: row.beforeGemstones as unknown as ProductGemstone[],
    },
    after: row.afterWeight && {
      weight: row.afterWeight.toFixed(3),
      netGoldWeight: row.afterNetWeight?.toFixed(3) ?? null,
      gemstones: row.afterGemstones as unknown as ProductGemstone[],
    },
    ...(canManageAsOwner(access) && {
      financial: {
        estimatedCost:
          row.estimatedCost && row.estimatedCurrency
            ? presentMoney(row.estimatedCost, row.estimatedCurrency)
            : null,
        actualCost:
          row.actualCost && row.actualCurrency
            ? presentMoney(row.actualCost, row.actualCurrency)
            : null,
        payment:
          row.paidDate && method
            ? { date: dateOnly(row.paidDate), method }
            : null,
      },
    }),
    events: row.events
      .filter(({ kind }) => kind !== "PAID" || canManageAsOwner(access))
      .map(({ id, kind, note, actor, createdAt }) => ({
        id,
        kind,
        note,
        actorName: actor.membership.user.fullName,
        createdAt: createdAt.toISOString(),
      })),
  };
}

const eventKinds = {
  send: "SENT",
  progress: "PROGRESS",
  complete: "COMPLETED",
  cancel: "CANCELED",
  pay: "PAID",
} as const satisfies Record<RepairCommand["action"], RepairEventKind>;

async function sendToRepair(
  tx: Tx,
  access: AccessContext,
  productId: string,
  command: Extract<RepairCommand, { action: "send" }>,
) {
  const scope = scopeOf(access);
  const product = await tx.product.findUnique({
    where: compound(scope, productId),
    select: {
      status: true,
      weight: true,
      netGoldWeight: true,
      gemstones: gemstoneFields,
      sale: { select: { id: true } },
      saleItem: { select: { saleId: true } },
    },
  });
  if (!product) throw new AccessError("PRODUCT_NOT_FOUND");
  if (product.status !== "IN_STOCK" || product.sale || product.saleItem)
    throw new AccessError("REPAIR_CONFLICT");
  const {
    supplierId,
    repairerName,
    description,
    estimatedCost,
    sentDate,
    expectedReturnDate,
  } = command;
  checkDate(sentDate, "sentDate");
  checkCurrency(access, estimatedCost?.currency, "estimatedCost");
  const supplier =
    supplierId &&
    (await tx.supplier.findUnique({
      where: compound(scope, supplierId),
      select: { name: true, isActive: true },
    }));
  if (supplierId && !supplier)
    throw new AccessError("SUPPLIER_NOT_FOUND", "supplierId");
  if (supplier && !supplier.isActive)
    throw new AccessError("SUPPLIER_INACTIVE", "supplierId");
  const { id } = await tx.repair.create({
    data: {
      ...scope,
      productId,
      supplierId,
      repairerName: supplier ? supplier.name : repairerName!,
      description,
      sentDate: toDate(sentDate),
      expectedReturnDate: expectedReturnDate && toDate(expectedReturnDate),
      beforeWeight: product.weight,
      beforeNetWeight: product.netGoldWeight,
      beforeGemstones: presentGemstones(product.gemstones),
      estimatedCost: estimatedCost?.amount,
      estimatedCurrency: estimatedCost?.currency,
      createdAt: new Date(),
    },
    select: { id: true },
  });
  await tx.product.update({
    where: compound(scope, productId),
    data: { status: "IN_REPAIR" },
  });
  return id;
}

function checkDate(value: string, field: string, earliest?: Date) {
  if (
    value > bakuDay.format(new Date()) ||
    (earliest && value < dateOnly(earliest))
  )
    throw new AccessError("INVALID_REPAIR", field);
}

function checkCurrency(
  access: AccessContext,
  currency: string | undefined,
  field: string,
) {
  if (currency && !checkoutCurrencies(access.settings).includes(currency))
    throw new AccessError("INVALID_REPAIR", field);
}

async function advanceRepair(
  tx: Tx,
  access: AccessContext,
  productId: string,
  command: Exclude<RepairCommand, { action: "send" }>,
) {
  const scope = scopeOf(access);
  const where = compound(scope, command.repairId);
  const repair = await tx.repair.findUnique({
    where: { ...where, productId },
    select: {
      status: true,
      sentDate: true,
      actualCost: true,
      paidDate: true,
      product: { select: { status: true } },
    },
  });
  if (!repair) throw new AccessError("REPAIR_NOT_FOUND");
  if (command.action === "pay") {
    if (
      repair.status !== "COMPLETED" ||
      !repair.actualCost?.gt(0) ||
      repair.paidDate
    )
      throw new AccessError("REPAIR_CONFLICT");
    checkDate(command.paymentDate, "paymentDate", repair.sentDate);
    await tx.repair.update({
      where,
      data: {
        paidDate: toDate(command.paymentDate),
        paymentMethod: command.method,
      },
    });
    return;
  }
  if (repair.status !== "ACTIVE" || repair.product.status !== "IN_REPAIR")
    throw new AccessError("REPAIR_CONFLICT");
  if (command.action === "progress") return;
  const productWhere = compound(scope, productId);
  if (command.action === "cancel") {
    await tx.repair.update({ where, data: { status: "CANCELED" } });
    await tx.product.update({
      where: productWhere,
      data: { status: "IN_STOCK" },
    });
    return;
  }
  const { completedDate, actualCost, weight, netGoldWeight, gemstones } =
    command;
  checkDate(completedDate, "completedDate", repair.sentDate);
  checkCurrency(access, actualCost.currency, "actualCost");
  await tx.repair.update({
    where,
    data: {
      status: "COMPLETED",
      completedDate: toDate(completedDate),
      afterWeight: weight,
      afterNetWeight: netGoldWeight,
      afterGemstones: gemstones.map((group) => ({ ...group })),
      actualCost: actualCost.amount,
      actualCurrency: actualCost.currency,
    },
  });
  await tx.product.update({
    where: productWhere,
    data: { status: "IN_STOCK", weight, netGoldWeight },
  });
  await tx.productGemstone.deleteMany({ where: { ...scope, productId } });
  if (gemstones.length)
    await tx.productGemstone.createMany({
      data: gemstones.map((group, position) => ({
        ...scope,
        productId,
        position,
        ...group,
      })),
    });
}

export async function writeRepair(
  db: OrganizationDatabase,
  access: AccessContext,
  productId: string,
  command: RepairCommand,
  idempotencyKey: string,
) {
  if (!uuidPattern.test(productId)) throw new AccessError("PRODUCT_NOT_FOUND");
  productId = productId.toLowerCase();
  const requestDigest = createHash("sha256")
    .update(JSON.stringify({ productId, command }))
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      const current = await lockProductOwner(tx, access);
      const scope = scopeOf(current);
      const key = { ...scope, actorId: current.userId, idempotencyKey };
      const previous = await tx.repairEvent.findUnique({
        where: { organizationId_storeId_actorId_idempotencyKey: key },
        select: { repairId: true, requestDigest: true },
      });
      if (previous) {
        if (previous.requestDigest !== requestDigest)
          throw new AccessError("REPAIR_REQUEST_CONFLICT", "idempotencyKey");
        return { id: previous.repairId };
      }
      let repairId;
      if (command.action === "send") {
        repairId = await sendToRepair(tx, current, productId, command);
      } else {
        repairId = command.repairId;
        await advanceRepair(tx, current, productId, command);
      }
      const kind = eventKinds[command.action];
      const createdAt = new Date();
      await tx.repairEvent.create({
        data: {
          ...key,
          repairId,
          requestDigest,
          kind,
          createdAt,
          note: "note" in command ? command.note : undefined,
        },
      });
      if (kind === "SENT" || kind === "COMPLETED" || kind === "CANCELED")
        await tx.inventoryMovement.create({
          data: {
            ...scope,
            actorId: current.userId,
            productId,
            repairId,
            kind: `REPAIR_${kind}`,
            createdAt,
          },
        });
      return { id: repairId };
    },
    { timeout: 30_000, isolationLevel: "ReadCommitted" },
  );
}
