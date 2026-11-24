import {
  isSupplierCurrency,
  isSupplierDate,
  purchasePaymentStatuses,
  supplierPaymentMethods,
  type MoneyInput,
  type PurchaseDetail,
  type PurchasePaymentStatus,
  type PurchaseSummary,
  type ReceivedProduct,
  type Supplier,
  type SupplierActivity,
  type SupplierOverview,
  type SupplierPage,
  type SupplierPayment,
  type SupplierPaymentMethod,
} from "@mizan/contracts";
import { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import {
  actorProfile,
  uuidPattern,
  type AccessContext,
} from "../access/access.service.js";
import { readPageSize } from "../access/page-size.js";
import {
  detailFields,
  listFields,
  presentGemstones,
  presentListItem,
} from "../products/product.presenter.js";

type Db = Prisma.TransactionClient;
export type SupplierScope = Pick<AccessContext, "organizationId" | "storeId">;
export type Filters = Record<string, string | undefined>;
export const scopeOf = ({ organizationId, storeId }: SupplierScope) => ({
  organizationId,
  storeId,
});

export function idKey(scope: SupplierScope, id: string) {
  return { organizationId_storeId_id: { ...scopeOf(scope), id } };
}

export function supplierKey(scope: SupplierScope, id: string) {
  if (!uuidPattern.test(id)) throw new AccessError("SUPPLIER_NOT_FOUND");
  return idKey(scope, id);
}

export function purchaseKey(scope: SupplierScope, id: string) {
  if (!uuidPattern.test(id)) throw new AccessError("PURCHASE_NOT_FOUND");
  return idKey(scope, id);
}

const supplierFields = {
  id: true,
  name: true,
  contactPerson: true,
  phone: true,
  email: true,
  address: true,
  taxId: true,
  note: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.SupplierSelect;

export function presentSupplier(
  row: Prisma.SupplierGetPayload<{ select: typeof supplierFields }>,
): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contactPerson,
    phone: row.phone,
    email: row.email,
    address: row.address,
    taxId: row.taxId,
    note: row.note,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function scopeWhere(scope: SupplierScope, alias: "p" | "s") {
  const table = alias === "p" ? Prisma.sql`p` : Prisma.sql`s`;
  return Prisma.sql`${table}."organizationId" = ${scope.organizationId}::uuid
    AND ${table}."storeId" = ${scope.storeId}::uuid`;
}

// Index-backed amounts for a scoped purchase. Never uses customer or retail ledgers.
const paymentAmounts = Prisma.sql`
  SELECT COALESCE(SUM(t.amount), 0) AS paid, MAX(t."paymentDate") AS "lastPaymentDate"
  FROM "mizan"."SupplierPayment" t
  WHERE (t."organizationId", t."storeId", t."purchaseId") = (p."organizationId", p."storeId", p.id)
`;
const itemTotals = Prisma.sql`
  SELECT COUNT(*)::int AS "productCount", COALESCE(SUM(r.weight), 0) AS "grossWeight"
  FROM "mizan"."PurchaseItem" i
  JOIN "mizan"."Product" r ON (r."organizationId", r."storeId", r.id) = (i."organizationId", i."storeId", i."productId")
  WHERE (i."organizationId", i."storeId", i."purchaseId") = (p."organizationId", p."storeId", p.id)
`;
const itemCount = Prisma.sql`
  (SELECT COUNT(*)::int FROM "mizan"."PurchaseItem" i
   WHERE (i."organizationId", i."storeId", i."purchaseId") = (p."organizationId", p."storeId", p.id))
`;

type AmountRow = {
  totalAmount: Prisma.Decimal;
  paid: Prisma.Decimal;
  outstanding: Prisma.Decimal;
};
type LedgerRow = AmountRow & {
  id: string;
  supplierId: string;
  supplierName: string;
  documentNumber: string | null;
  purchaseDate: Date;
  currency: string;
  productCount: number;
  grossWeight: Prisma.Decimal;
  note: string | null;
  createdAt: Date;
};

function money(value: Prisma.Decimal, currency: string): MoneyInput {
  return { amount: value.toFixed(), currency };
}

function calendarDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function purchaseStatus(row: AmountRow): PurchasePaymentStatus {
  if (row.outstanding.isZero()) return "PAID";
  return row.paid.isZero() ? "UNPAID" : "PARTIALLY_PAID";
}

function purchaseSummary(row: LedgerRow): PurchaseSummary {
  return {
    id: row.id,
    supplier: { id: row.supplierId, name: row.supplierName },
    documentNumber: row.documentNumber,
    purchaseDate: calendarDate(row.purchaseDate),
    productCount: row.productCount,
    grossWeight: row.grossWeight.toFixed(3),
    total: money(row.totalAmount, row.currency),
    paid: money(row.paid, row.currency),
    outstanding: money(row.outstanding, row.currency),
    status: purchaseStatus(row),
  };
}

function page<T, U>(
  rows: T[],
  limit: number,
  id: (row: T) => string,
  present: (row: T) => U,
): SupplierPage<U> {
  return {
    items: rows.slice(0, limit).map(present),
    ...(rows.length > limit && { nextCursor: id(rows[limit - 1]) }),
  };
}

function bad(field: string): never {
  throw new AccessError("INVALID_SUPPLIER", field);
}

function searchTerm(q: string | undefined) {
  if (
    q !== undefined &&
    (typeof q !== "string" || q.length > 160 || q.includes("\0"))
  )
    bad("q");
  return q?.trim() || undefined;
}

function dates({ from, through }: Filters) {
  if (from !== undefined && !isSupplierDate(from)) bad("from");
  if (
    through !== undefined &&
    (!isSupplierDate(through) || (from && through < from))
  )
    bad("through");
  return { from, through };
}

async function getSupplierRow(db: Db, scope: SupplierScope, id: string) {
  const row = await db.supplier.findUnique({
    where: supplierKey(scope, id),
    select: supplierFields,
  });
  if (!row) throw new AccessError("SUPPLIER_NOT_FOUND");
  return row;
}

export async function listSuppliers(
  db: Db,
  scope: SupplierScope,
  filters: Filters,
) {
  const limit = readPageSize(filters.limit ?? "10", "INVALID_SUPPLIER");
  const { active, outstanding, after } = filters;
  if (active !== undefined && active !== "true" && active !== "false")
    bad("active");
  if (outstanding !== undefined && outstanding !== "true") bad("outstanding");
  const q = searchTerm(filters.q);
  const phone = q?.replace(/\D/g, "");
  const phoneSearch = phone && /^[+0-9 ()-]+$/.test(q ?? "");
  let cursor;
  if (after !== undefined) {
    if (!uuidPattern.test(after)) bad("after");
    cursor = await db.supplier.findUnique({
      where: idKey(scope, after),
      select: { id: true, createdAt: true },
    });
    if (!cursor) bad("after");
  }
  const rows = await db.$queryRaw<
    Prisma.SupplierGetPayload<{ select: typeof supplierFields }>[]
  >(Prisma.sql`
    SELECT s.id, s.name, s."contactPerson", s.phone, s.email, s.address, s."taxId", s.note, s."isActive", s."createdAt", s."updatedAt"
    FROM "mizan"."Supplier" s
    WHERE ${scopeWhere(scope, "s")}
      ${active === undefined ? Prisma.empty : Prisma.sql`AND s."isActive" = ${active === "true"}`}
      ${
        q
          ? Prisma.sql`AND (strpos(lower(s.name), lower(${q})) > 0 OR strpos(lower(s."contactPerson"), lower(${q})) > 0
        ${phoneSearch ? Prisma.sql`OR strpos(s."phoneDigits", ${phone}) > 0` : Prisma.empty})`
          : Prisma.empty
      }
      ${
        outstanding
          ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "mizan"."Purchase" p CROSS JOIN LATERAL (${paymentAmounts}) a
        WHERE (p."organizationId", p."storeId", p."supplierId") = (s."organizationId", s."storeId", s.id)
          AND p."totalAmount" > a.paid
      )`
          : Prisma.empty
      }
      ${cursor ? Prisma.sql`AND (s."createdAt", s.id) < (${cursor.createdAt}, ${cursor.id}::uuid)` : Prisma.empty}
    ORDER BY s."createdAt" DESC, s.id DESC
    LIMIT ${limit + 1}
  `);
  return page(rows, limit, (row) => row.id, presentSupplier);
}

export async function supplierOverview(
  db: Db,
  scope: SupplierScope,
  supplierId: string,
): Promise<SupplierOverview> {
  const supplier = presentSupplier(await getSupplierRow(db, scope, supplierId));
  const rows = await db.$queryRaw<
    (AmountRow & {
      currency: string;
      purchaseCount: number;
      productCount: number;
      lastPurchaseDate: Date;
      lastPaymentDate: Date | null;
    })[]
  >(Prisma.sql`
    SELECT p.currency, SUM(p."totalAmount") AS "totalAmount", SUM(a.paid) AS paid,
      SUM(p."totalAmount" - a.paid) AS outstanding,
      COUNT(*)::int AS "purchaseCount", SUM(${itemCount})::int AS "productCount",
      MAX(p."purchaseDate") AS "lastPurchaseDate", MAX(a."lastPaymentDate") AS "lastPaymentDate"
    FROM "mizan"."Purchase" p CROSS JOIN LATERAL (${paymentAmounts}) a
    WHERE ${scopeWhere(scope, "p")} AND p."supplierId" = ${supplier.id}::uuid
    GROUP BY p.currency ORDER BY p.currency
  `);
  const lastPurchase = rows
    .map((row) => calendarDate(row.lastPurchaseDate))
    .sort()
    .at(-1);
  const lastPayment = rows
    .flatMap((row) =>
      row.lastPaymentDate ? [calendarDate(row.lastPaymentDate)] : [],
    )
    .sort()
    .at(-1);
  return {
    supplier,
    balances: rows.map(({ currency, totalAmount, paid, outstanding }) => ({
      currency,
      purchased: money(totalAmount, currency),
      paid: money(paid, currency),
      outstanding: money(outstanding, currency),
    })),
    purchaseCount: rows.reduce((count, row) => count + row.purchaseCount, 0),
    productCount: rows.reduce((count, row) => count + row.productCount, 0),
    lastPurchaseDate: lastPurchase ?? null,
    lastPaymentDate: lastPayment ?? null,
  };
}

function readLedger(
  db: Db,
  scope: SupplierScope,
  filters: Prisma.Sql,
  limit: number,
) {
  return db.$queryRaw<LedgerRow[]>(Prisma.sql`
    SELECT p.id, p."supplierId", COALESCE(p."supplierName", s.name) AS "supplierName", p."documentNumber", p."purchaseDate",
      p.currency, p."totalAmount", a.paid, p."totalAmount" - a.paid AS outstanding,
      p.note, p."createdAt", i."productCount", i."grossWeight"
    FROM "mizan"."Purchase" p
    JOIN "mizan"."Supplier" s ON (s."organizationId", s."storeId", s.id) = (p."organizationId", p."storeId", p."supplierId")
    CROSS JOIN LATERAL (${paymentAmounts}) a
    CROSS JOIN LATERAL (${itemTotals}) i
    WHERE ${scopeWhere(scope, "p")} ${filters}
    ORDER BY p."purchaseDate" DESC, p.id DESC
    LIMIT ${limit}
  `);
}

export async function purchaseAmounts(
  db: Db,
  scope: SupplierScope,
  id: string,
) {
  purchaseKey(scope, id);
  const [row] = await readLedger(
    db,
    scope,
    Prisma.sql`AND p.id = ${id}::uuid`,
    1,
  );
  if (!row) throw new AccessError("PURCHASE_NOT_FOUND");
  return row;
}

export async function listPurchases(
  db: Db,
  scope: SupplierScope,
  filters: Filters,
) {
  const limit = readPageSize(filters.limit ?? "10", "INVALID_SUPPLIER");
  const { from, through } = dates(filters);
  const { status, currency, supplierId, after } = filters;
  if (
    status !== undefined &&
    !purchasePaymentStatuses.includes(status as PurchasePaymentStatus)
  )
    bad("status");
  if (currency !== undefined && !isSupplierCurrency(currency)) bad("currency");
  if (supplierId !== undefined) await getSupplierRow(db, scope, supplierId);
  let cursor;
  if (after !== undefined) {
    if (!uuidPattern.test(after)) bad("after");
    cursor = await db.purchase.findFirst({
      where: { ...scopeOf(scope), id: after, supplierId },
      select: { id: true, purchaseDate: true },
    });
    if (!cursor) bad("after");
  }
  const byStatus = {
    UNPAID: Prisma.sql`AND a.paid = 0 AND p."totalAmount" > 0`,
    PARTIALLY_PAID: Prisma.sql`AND a.paid > 0 AND a.paid < p."totalAmount"`,
    PAID: Prisma.sql`AND a.paid = p."totalAmount"`,
  };
  const rows = await readLedger(
    db,
    scope,
    Prisma.sql`
    ${from ? Prisma.sql`AND p."purchaseDate" >= ${from}::date` : Prisma.empty}
    ${through ? Prisma.sql`AND p."purchaseDate" <= ${through}::date` : Prisma.empty}
    ${supplierId ? Prisma.sql`AND p."supplierId" = ${supplierId}::uuid` : Prisma.empty}
    ${currency ? Prisma.sql`AND p.currency = ${currency}` : Prisma.empty}
    ${status ? byStatus[status as PurchasePaymentStatus] : Prisma.empty}
    ${cursor ? Prisma.sql`AND (p."purchaseDate", p.id) < (${calendarDate(cursor.purchaseDate)}::date, ${cursor.id}::uuid)` : Prisma.empty}
  `,
    limit + 1,
  );
  return page(rows, limit, (row) => row.id, purchaseSummary);
}

export async function getPurchase(
  db: Db,
  access: AccessContext,
  id: string,
): Promise<PurchaseDetail> {
  const amounts = await purchaseAmounts(db, access, id);
  const row = await db.purchase.findUniqueOrThrow({
    where: purchaseKey(access, id),
    select: {
      actor: actorProfile,
      items: {
        orderBy: { position: "asc" },
        select: {
          acquisitionCost: true,
          product: {
            select: {
              ...listFields,
              metalType: true,
              netGoldWeight: true,
              gemstones: detailFields(access).gemstones,
              acquisitionCostPerGram: true,
              acquisitionMetal: true,
              acquisitionGemstones: true,
              acquisitionWorkmanship: true,
              acquisitionOther: true,
            },
          },
        },
      },
    },
  });
  return {
    ...purchaseSummary(amounts),
    note: amounts.note,
    createdAt: amounts.createdAt.toISOString(),
    actorName: row.actor.membership.user.fullName,
    products: row.items.map(({ acquisitionCost, product }) => ({
      ...presentListItem(product),
      category: product.category,
      metalType: product.metalType,
      netGoldWeight: product.netGoldWeight?.toFixed(),
      gemstones: presentGemstones(product.gemstones),
      acquisitionCost: money(acquisitionCost, amounts.currency),
      acquisitionCostPerGram: product.acquisitionCostPerGram
        ? money(product.acquisitionCostPerGram, amounts.currency)
        : undefined,
      acquisitionBreakdown: {
        metal: product.acquisitionMetal?.toFixed(),
        gemstones: product.acquisitionGemstones?.toFixed(),
        workmanship: product.acquisitionWorkmanship?.toFixed(),
        other: product.acquisitionOther?.toFixed(),
      },
      purchaseDate: calendarDate(amounts.purchaseDate),
    })),
  };
}

export async function listSupplierProducts(
  db: Db,
  scope: SupplierScope,
  supplierId: string,
  filters: Filters,
): Promise<SupplierPage<ReceivedProduct>> {
  await getSupplierRow(db, scope, supplierId);
  const limit = readPageSize(filters.limit ?? "10", "INVALID_SUPPLIER");
  const { status, categoryId, purity, after } = filters;
  if (status !== undefined && status !== "IN_STOCK" && status !== "SOLD")
    bad("status");
  if (categoryId !== undefined && !uuidPattern.test(categoryId))
    bad("categoryId");
  if (
    purity !== undefined &&
    (typeof purity !== "string" || !/^[1-9]\d{0,2}$/.test(purity))
  )
    bad("purity");
  const q = searchTerm(filters.q)?.replace(/[\\%_]/g, "\\$&");
  if (
    after !== undefined &&
    (typeof after !== "string" ||
      !after.length ||
      after.length > 80 ||
      after.includes("\0"))
  )
    bad("after");
  const rows = await db.purchaseItem.findMany({
    where: {
      ...scopeOf(scope),
      purchase: { supplierId },
      product: {
        status,
        categoryId,
        purity: purity ? Number(purity) : undefined,
        code: after ? { gt: after } : undefined,
        OR: q
          ? [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ]
          : undefined,
      },
    },
    orderBy: { product: { code: "asc" } },
    take: limit + 1,
    select: {
      acquisitionCost: true,
      purchase: { select: { currency: true, purchaseDate: true } },
      product: { select: listFields },
    },
  });
  return page(
    rows,
    limit,
    (row) => row.product.code,
    ({ product, purchase, acquisitionCost }) => ({
      ...presentListItem(product),
      acquisitionCost: money(acquisitionCost, purchase.currency),
      purchaseDate: calendarDate(purchase.purchaseDate),
    }),
  );
}

export const paymentFields = {
  id: true,
  amount: true,
  currency: true,
  method: true,
  isInitial: true,
  paymentDate: true,
  referenceNumber: true,
  note: true,
  createdAt: true,
  purchaseId: true,
  purchase: { select: { documentNumber: true, purchaseDate: true } },
  actor: actorProfile,
} as const satisfies Prisma.SupplierPaymentSelect;

export function presentPayment(
  row: Prisma.SupplierPaymentGetPayload<{ select: typeof paymentFields }>,
): SupplierPayment {
  return {
    id: row.id,
    ...money(row.amount, row.currency),
    method: row.method as SupplierPaymentMethod,
    isInitial: row.isInitial,
    paymentDate: calendarDate(row.paymentDate),
    referenceNumber: row.referenceNumber,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    purchaseId: row.purchaseId,
    documentNumber: row.purchase.documentNumber,
    purchaseDate: calendarDate(row.purchase.purchaseDate),
    actorName: row.actor.membership.user.fullName,
  };
}

export async function listPayments(
  db: Db,
  scope: SupplierScope,
  supplierId: string,
  filters: Filters,
) {
  await getSupplierRow(db, scope, supplierId);
  const limit = readPageSize(filters.limit ?? "10", "INVALID_SUPPLIER");
  const { from, through } = dates(filters);
  const { method, purchaseId, after } = filters;
  if (
    method !== undefined &&
    !supplierPaymentMethods.includes(method as SupplierPaymentMethod)
  )
    bad("method");
  if (purchaseId !== undefined) {
    const purchase = await db.purchase.findUnique({
      where: purchaseKey(scope, purchaseId),
      select: { supplierId: true },
    });
    if (purchase?.supplierId !== supplierId)
      throw new AccessError("PURCHASE_NOT_FOUND");
  }
  const where = { ...scopeOf(scope), purchaseId, purchase: { supplierId } };
  let cursor;
  if (after !== undefined) {
    if (!uuidPattern.test(after)) bad("after");
    cursor = await db.supplierPayment.findFirst({
      where: { ...where, id: after },
      select: { paymentDate: true, createdAt: true, id: true },
    });
    if (!cursor) bad("after");
  }
  const rows = await db.supplierPayment.findMany({
    where: {
      ...where,
      method,
      paymentDate: {
        gte: from ? new Date(from) : undefined,
        lte: through ? new Date(through) : undefined,
      },
      OR: cursor
        ? [
            { paymentDate: { lt: cursor.paymentDate } },
            {
              paymentDate: cursor.paymentDate,
              createdAt: { lt: cursor.createdAt },
            },
            {
              paymentDate: cursor.paymentDate,
              createdAt: cursor.createdAt,
              id: { lt: cursor.id },
            },
          ]
        : undefined,
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: paymentFields,
  });
  return page(rows, limit, (row) => row.id, presentPayment);
}

export async function listActivity(
  db: Db,
  scope: SupplierScope,
  supplierId: string,
  filters: Filters,
): Promise<SupplierPage<SupplierActivity>> {
  await getSupplierRow(db, scope, supplierId);
  const limit = readPageSize(filters.limit ?? "10", "INVALID_SUPPLIER");
  const { after } = filters;
  if (
    after !== undefined &&
    (typeof after !== "string" ||
      !/^[1-9]\d{0,18}$/.test(after) ||
      BigInt(after) > 9223372036854775807n)
  )
    bad("after");
  const rows = await db.supplierActivity.findMany({
    where: {
      ...scopeOf(scope),
      supplierId,
      id: after ? { lt: BigInt(after) } : undefined,
    },
    orderBy: { id: "desc" },
    take: limit + 1,
    select: {
      id: true,
      kind: true,
      actor: actorProfile,
      createdAt: true,
      purchaseId: true,
      productCount: true,
      productId: true,
    },
  });
  return page(
    rows,
    limit,
    (row) => row.id.toString(),
    (row) => ({
      id: row.id.toString(),
      kind: row.kind,
      purchaseId: row.purchaseId,
      ...(row.productId && { productId: row.productId }),
      productCount: row.productCount,
      actorName: row.actor.membership.user.fullName,
      createdAt: row.createdAt.toISOString(),
    }),
  );
}
