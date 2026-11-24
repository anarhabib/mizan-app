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
import { readPageSize } from "../access/page-size.js";
import { uuidPattern, type AccessContext } from "../access/access.service.js";
import { canManageAsOwner } from "../access/display-mode.js";
import { lockOrganization } from "../access/organization-owner.js";
import type { SalesDatabase } from "../sales/sale.service.js";
import { returnSummary, returnTotals } from "../sales/sale-return.service.js";
import { paidSaleAmount, SaleDecimal } from "../sales/settlement.js";

type CustomerDatabase = Pick<
  Prisma.TransactionClient,
  "customer" | "sale" | "$queryRaw"
>;
type Scope = Pick<AccessContext, "organizationId" | "storeId">;
const contact = { id: true, name: true, phone: true } as const;
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
      netPurchases: Prisma.Decimal | null;
      hasReturns: boolean;
      debt: Prisma.Decimal;
      lastPurchaseAt: Date;
    }>
  >`
    SELECT s."customerId",
      ROUND(SUM(s."defaultSaleAmount" * s."customerReportingRate"), 2) AS purchases,
      ROUND(SUM((s."defaultSaleAmount" - COALESCE(r.value, 0)) * s."customerReportingRate"), 2) AS "netPurchases",
      bool_or(r.value IS NOT NULL) AS "hasReturns",
      ROUND(SUM(s."outstandingDebt" * s."customerReportingRate"), 2) AS debt,
      MAX(s."createdAt") AS "lastPurchaseAt"
    FROM "mizan"."Sale" s LEFT JOIN LATERAL (
      SELECT SUM("returnedValue") value FROM "mizan"."SaleReturn"
      WHERE ("organizationId", "storeId", "saleId") = (s."organizationId", s."storeId", s.id)
    ) r ON true
    WHERE s."organizationId" = ${organizationId}::uuid AND s."storeId" = ${storeId}::uuid
      AND s."customerId" IN (${Prisma.join(customers.map(({ id }) => Prisma.sql`${id}::uuid`))})
    GROUP BY s."customerId"
  `;
  const totals = new Map(rows.map((row) => [row.customerId, row]));
  return customers.map((customer) => {
    const row = totals.get(customer.id);
    return {
      ...customer,
      totalPurchases: azn(row?.purchases.toFixed(2) ?? "0.00"),
      ...(row?.hasReturns &&
        row.netPurchases && { netPurchases: azn(row.netPurchases.toFixed(2)) }),
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
  {
    q,
    after,
    outstanding,
    limit,
  }: { q?: string; after?: string; outstanding?: string; limit?: string },
): Promise<CustomerList> {
  const pageSize = readPageSize(limit, "INVALID_CUSTOMER");
  const scope = { organizationId, storeId };
  if (outstanding !== undefined && outstanding !== "true")
    throw new AccessError("INVALID_CUSTOMER", "outstanding");
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
      ...(outstanding && { sales: { some: { outstandingDebt: { gt: 0 } } } }),
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
  limit?: string,
): Promise<CustomerHistory> {
  const pageSize = readPageSize(limit, "INVALID_CUSTOMER");
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
      returns: returnSummary,
    },
  });
  return {
    items: rows.slice(0, pageSize).map((sale) => {
      const totals = returnTotals(sale.returns);
      const count = sale.returns.reduce(
        (sum, row) => sum + row.items.length,
        0,
      );
      const money = (value: Prisma.Decimal) => ({
        amount: value.toFixed(),
        currency: sale.defaultCurrency,
      });
      const paid = paidSaleAmount(
        new SaleDecimal(sale.defaultSettlement).minus(totals.canceled),
        sale.outstandingDebt,
      );
      return {
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
          amount: paid,
          currency: sale.defaultCurrency,
        },
        payment:
          sale.paymentCurrency && sale.paymentAmount
            ? {
                amount: sale.paymentAmount.toFixed(),
                currency: sale.paymentCurrency,
              }
            : null,
        ...(count && {
          returnStatus:
            count === (sale._count.items || 1)
              ? ("RETURNED" as const)
              : ("PARTIALLY_RETURNED" as const),
          returnedValue: money(totals.value),
          netTotal: money(
            new SaleDecimal(sale.defaultSaleAmount).minus(totals.value),
          ),
          netPaidAmount: money(new SaleDecimal(paid).minus(totals.refunded)),
        }),
      };
    }),
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
