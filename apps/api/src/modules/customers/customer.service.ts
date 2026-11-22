import {
  parseCustomerInput,
  type CustomerContact,
  type CustomerDetail,
  type CustomerHistory,
  type CustomerList,
  type CustomerSummary,
} from "@mizan/contracts";
import { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import { uuidPattern, type AccessContext } from "../access/access.service.js";
import { canManageAsOwner } from "../access/display-mode.js";
import { lockOrganization } from "../access/organization-owner.js";
import type { SalesDatabase } from "../sales/sale.service.js";
import { paidSaleAmount } from "../sales/settlement.js";

type CustomerDatabase = Pick<
  Prisma.TransactionClient,
  "customer" | "sale" | "$queryRaw"
>;
type Scope = Pick<AccessContext, "organizationId" | "storeId">;
const contact = { id: true, name: true, phone: true } as const;
const pageSize = 50;
const recentFirst = [{ createdAt: "desc" }, { id: "desc" }] as const;
const azn = (amount: string) => ({ amount, currency: "AZN" });

function scopedId({ organizationId, storeId }: Scope, id: string) {
  return { organizationId, storeId, id };
}

function customerKey(scope: Scope, id: string) {
  if (!uuidPattern.test(id)) throw new AccessError("CUSTOMER_NOT_FOUND");
  return { organizationId_storeId_id: scopedId(scope, id) };
}

async function getContact(db: CustomerDatabase, scope: Scope, id: string) {
  const customer = await db.customer.findUnique({
    where: customerKey(scope, id),
    select: contact,
  });
  if (!customer) throw new AccessError("CUSTOMER_NOT_FOUND");
  return customer;
}

async function summarize(
  db: CustomerDatabase,
  { organizationId, storeId }: Scope,
  customers: CustomerContact[],
): Promise<CustomerSummary[]> {
  if (!customers.length) return [];
  const rows = await db.$queryRaw<
    Array<{
      customerId: string;
      purchases: Prisma.Decimal;
      debt: Prisma.Decimal;
      lastPurchaseAt: Date;
    }>
  >`
    SELECT "customerId",
      ROUND(SUM("defaultSaleAmount" * "customerReportingRate"), 2) AS purchases,
      ROUND(SUM("outstandingDebt" * "customerReportingRate"), 2) AS debt,
      MAX("createdAt") AS "lastPurchaseAt"
    FROM "mizan"."Sale"
    WHERE "organizationId" = ${organizationId}::uuid AND "storeId" = ${storeId}::uuid
      AND "customerId" IN (${Prisma.join(customers.map(({ id }) => Prisma.sql`${id}::uuid`))})
    GROUP BY "customerId"
  `;
  const totals = new Map(rows.map((row) => [row.customerId, row]));
  return customers.map((customer) => {
    const row = totals.get(customer.id);
    return {
      ...customer,
      totalPurchases: azn(row?.purchases.toFixed(2) ?? "0.00"),
      outstandingDebt: azn(row?.debt.toFixed(2) ?? "0.00"),
      lastPurchaseAt: row?.lastPurchaseAt.toISOString() ?? null,
    };
  });
}

function afterCursor(
  cursor: { createdAt: Date; id: string } | null | undefined,
) {
  return cursor
    ? {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }
    : {};
}

export async function listCustomers(
  db: CustomerDatabase,
  { organizationId, storeId }: Scope,
  { q, after }: { q?: string; after?: string },
): Promise<CustomerList> {
  const scope = { organizationId, storeId };
  if (
    q !== undefined &&
    (typeof q !== "string" || q.length > 160 || q.includes("\0"))
  )
    throw new AccessError("INVALID_CUSTOMER", "q");
  if (
    after !== undefined &&
    (typeof after !== "string" || !uuidPattern.test(after))
  )
    throw new AccessError("INVALID_CUSTOMER", "after");
  const cursor =
    after &&
    (await db.customer.findUnique({
      where: customerKey(scope, after),
      select: { id: true, createdAt: true },
    }));
  if (after && !cursor) throw new AccessError("INVALID_CUSTOMER", "after");
  const search = q?.trim().replace(/[\\%_]/g, "\\$&");
  const phone =
    search && /^\+?[0-9 ()-]+$/.test(search) ? search.replace(/\D/g, "") : "";
  const rows = await db.customer.findMany({
    where: {
      ...scope,
      ...afterCursor(cursor || null),
      ...(search && {
        AND: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            ...(phone ? [{ phoneDigits: { contains: phone } }] : []),
          ],
        },
      }),
    },
    orderBy: [...recentFirst],
    take: pageSize + 1,
    select: contact,
  });
  return {
    items: await summarize(db, scope, rows.slice(0, pageSize)),
    nextCursor: rows.length > pageSize ? rows[pageSize - 1].id : undefined,
  };
}

export async function getCustomer(
  db: CustomerDatabase,
  scope: Scope,
  id: string,
): Promise<CustomerDetail> {
  const record = await db.customer.findUnique({
    where: customerKey(scope, id),
    select: { ...contact, note: true },
  });
  if (!record) throw new AccessError("CUSTOMER_NOT_FOUND");
  const { note, ...customer } = record;
  const [summary] = await summarize(db, scope, [customer]);
  return { ...summary, note };
}

export async function listCustomerPurchases(
  db: CustomerDatabase,
  scope: Scope,
  id: string,
  after?: string,
): Promise<CustomerHistory> {
  await getContact(db, scope, id);
  if (
    after !== undefined &&
    (typeof after !== "string" || !uuidPattern.test(after))
  )
    throw new AccessError("INVALID_CUSTOMER", "after");
  const where = {
    organizationId: scope.organizationId,
    storeId: scope.storeId,
    customerId: id,
  };
  const cursor =
    after &&
    (await db.sale.findFirst({
      where: { ...where, id: after },
      select: { id: true, createdAt: true },
    }));
  if (after && !cursor) throw new AccessError("INVALID_CUSTOMER", "after");
  const rows = await db.sale.findMany({
    where: { ...where, ...afterCursor(cursor || null) },
    orderBy: [...recentFirst],
    take: pageSize + 1,
    select: {
      id: true,
      createdAt: true,
      productName: true,
      defaultCurrency: true,
      defaultSaleAmount: true,
      acceptedTradeInTotal: true,
      defaultSettlement: true,
      outstandingDebt: true,
      paymentCurrency: true,
      paymentAmount: true,
      _count: { select: { items: true } },
    },
  });
  return {
    items: rows.slice(0, pageSize).map((sale) => ({
      id: sale.id,
      createdAt: sale.createdAt.toISOString(),
      productName: sale.productName,
      itemCount: sale._count.items || 1,
      total: {
        amount: sale.defaultSaleAmount.toFixed(),
        currency: sale.defaultCurrency,
      },
      outstandingDebt: {
        amount: sale.outstandingDebt.toFixed(),
        currency: sale.defaultCurrency,
      },
      tradeInCredit: {
        amount: sale.acceptedTradeInTotal.toFixed(),
        currency: sale.defaultCurrency,
      },
      paidAmount: {
        amount: paidSaleAmount(sale.defaultSettlement, sale.outstandingDebt),
        currency: sale.defaultCurrency,
      },
      payment:
        sale.paymentCurrency && sale.paymentAmount
          ? {
              amount: sale.paymentAmount.toFixed(),
              currency: sale.paymentCurrency,
            }
          : null,
    })),
    nextCursor: rows.length > pageSize ? rows[pageSize - 1].id : undefined,
  };
}

export async function saveCustomer(
  db: CustomerDatabase,
  { organizationId, storeId }: Scope,
  body: unknown,
  id?: string,
) {
  const parsed = parseCustomerInput(body);
  if ("field" in parsed)
    throw new AccessError("INVALID_CUSTOMER", parsed.field);
  const data = {
    ...parsed.input,
    phoneDigits: parsed.input.phone.replace(/\D/g, ""),
  };
  const scope = { organizationId, storeId };
  if (id === undefined)
    return db.customer.create({ data: { ...scope, ...data }, select: contact });
  try {
    return await db.customer.update({
      where: customerKey(scope, id),
      data,
      select: contact,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    )
      throw new AccessError("CUSTOMER_NOT_FOUND");
    throw error;
  }
}

export async function deleteCustomer(
  db: SalesDatabase,
  access: AccessContext,
  id: string,
) {
  if (!canManageAsOwner(access)) throw new AccessError("ACCESS_DENIED");
  const where = customerKey(access, id);
  await db.$transaction(async (tx) => {
    await lockOrganization(tx, access.organizationId);
    try {
      await tx.customer.delete({ where, select: { id: true } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") throw new AccessError("CUSTOMER_NOT_FOUND");
        if (error.code === "P2003")
          throw new AccessError("CUSTOMER_DELETE_CONFLICT");
      }
      throw error;
    }
  });
}
