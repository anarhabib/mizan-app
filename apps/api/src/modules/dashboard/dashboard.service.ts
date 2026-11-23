import type {
  DashboardActivity,
  DashboardAgedStock,
  DashboardCharts,
  DashboardOwnerSummary,
  DashboardSummary,
} from "@mizan/contracts";
import { Prisma } from "@mizan/database";
import type { AccessContext } from "../access/access.service.js";
import { readGoldMarket } from "../gold-prices/gold-market.service.js";
import { SaleDecimal } from "../sales/settlement.js";
import { compareDay, compareMoney } from "./comparison.js";

type Scope = Pick<AccessContext, "organizationId" | "storeId">;
const dayMs = 86_400_000;
const bakuDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Baku" });

export function dashboardWindow(now: Date) {
  const day = bakuDay.format(now);
  const start = new Date(`${day}T00:00:00+04:00`);
  return {
    day,
    start,
    previousStart: new Date(start.getTime() - dayMs),
    previousThrough: new Date(now.getTime() - dayMs),
    weekStart: new Date(start.getTime() - 6 * dayMs),
  };
}

function store({ organizationId, storeId }: Scope) {
  return Prisma.sql`"organizationId" = ${organizationId}::uuid AND "storeId" = ${storeId}::uuid`;
}

// Each row includes its denomination. Keep numeric JSON values as strings.
function money(rows: Prisma.Sql) {
  return Prisma.sql`(SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'currency', currency, 'amount', trim_scale(amount)::text
  ) ORDER BY currency), '[]'::jsonb) FROM (${rows}) AS amounts)`;
}

function scopedSales(scope: Scope, start: Date, now: Date) {
  return Prisma.sql`SELECT s.* FROM "mizan"."Sale" s
    WHERE ${store(scope)} AND "createdAt" >= ${start} AND "createdAt" < ${now}`;
}

function payments(
  scope: Scope,
  start: Date,
  now: Date,
  sales = Prisma.sql`sales`,
) {
  return Prisma.sql`
    SELECT currency, amount, "amountAzn" AS normalized, method, "position" IS NULL AS repayment, "createdAt"
    FROM "mizan"."SalePayment"
    WHERE ${store(scope)} AND "createdAt" >= ${start} AND "createdAt" < ${now}
    UNION ALL
    SELECT s."paymentCurrency", net.amount,
      ROUND(net.amount * s."paymentExchangeRate" *
        (CASE WHEN s.currency = 'AZN' THEN 1 ELSE s."customerReportingRate" END), 2),
      'LEGACY', false, s."createdAt"
    FROM ${sales} s
    CROSS JOIN LATERAL (
      SELECT CASE WHEN COALESCE(s."changeAmount", 0) = 0 THEN s."paymentAmount"
        ELSE GREATEST(s."paymentAmount" - s."changeAmount" / s."paymentExchangeRate", 0)
      END AS amount
    ) net
    WHERE s."paymentCurrency" IS NOT NULL AND s."paymentExchangeRate" > 0
      AND net.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM "mizan"."SalePayment" p
        WHERE p."organizationId" = s."organizationId" AND p."storeId" = s."storeId"
          AND p."saleId" = s.id AND p.position IS NOT NULL
      )`;
}

function intake(scope: Scope, start: Date, now: Date) {
  return Prisma.sql`
    SELECT "productId", MIN("createdAt") AS "receivedAt"
    FROM "mizan"."InventoryMovement"
    WHERE ${store(scope)} AND kind = 'PRODUCT_ADDED' AND "productId" IS NOT NULL
    GROUP BY "productId"
    HAVING MIN("createdAt") >= ${start} AND MIN("createdAt") < ${now}`;
}

const totalPayments = Prisma.sql`SELECT currency, SUM(amount) AS amount FROM payments`;
const paymentStatus = Prisma.sql`CASE WHEN "outstandingDebt" = 0 THEN 'PAID'
  WHEN "outstandingDebt" = "defaultSettlement" THEN 'UNPAID' ELSE 'PARTIALLY_PAID' END`;

export async function dashboardSummary(
  db: Prisma.TransactionClient,
  scope: Scope,
  goldEnabled: boolean,
  now = new Date(),
): Promise<DashboardSummary> {
  const { day, start, previousStart, previousThrough } = dashboardWindow(now);
  const saleStats = (table: "sales" | "previous_sales") => {
    const source = Prisma.raw(table);
    return Prisma.sql`jsonb_build_object(
      'total', ${money(Prisma.sql`SELECT currency, SUM("saleAmount") amount FROM ${source} GROUP BY currency`)},
      'count', (SELECT COUNT(*) FROM ${source}),
      'products', (SELECT COALESCE(SUM(GREATEST(1, (SELECT COUNT(*)
        FROM "mizan"."SaleItem" i WHERE i."organizationId" = s."organizationId"
          AND i."storeId" = s."storeId" AND i."saleId" = s.id))), 0) FROM ${source} s),
      'average', ${money(Prisma.sql`SELECT currency, ROUND(AVG("saleAmount"), 4) amount FROM ${source} GROUP BY currency`)}
    )`;
  };
  const [[row], market] = await Promise.all([
    db.$queryRaw<
      {
        sales: DashboardSummary["sales"];
        previousSales: DashboardSummary["sales"];
        payments: DashboardSummary["payments"];
        previousReceipts: string | null;
        previousIntake: number;
        debt: DashboardSummary["debt"];
        intake: DashboardSummary["intake"];
        inventory: Omit<DashboardSummary["inventory"], "marketValue">;
        fineWeight: string | null;
      }[]
    >`
      WITH sales AS (${scopedSales(scope, start, now)}),
      previous_sales AS (${scopedSales(scope, previousStart, previousThrough)}),
      payments AS (${payments(scope, start, now)}),
      previous_payments AS (${payments(scope, previousStart, previousThrough, Prisma.sql`previous_sales`)}),
      recent_intake AS (${intake(scope, previousStart, now)}),
      intake AS (SELECT "productId" FROM recent_intake WHERE "receivedAt" >= ${start}),
      stock AS (
        SELECT weight, "netGoldWeight", purity, "metalType" FROM "mizan"."Product"
        WHERE ${store(scope)} AND status = 'IN_STOCK'
      ),
      trade_ins AS (
        SELECT s.currency, t.weight, t."acceptedValue"
        FROM "mizan"."ReceivedOldGold" r
        JOIN "mizan"."TradeIn" t ON (t."organizationId", t."storeId", t.id) =
          (r."organizationId", r."storeId", r."tradeInId")
        JOIN "mizan"."Sale" s ON (s."organizationId", s."storeId", s.id) =
          (t."organizationId", t."storeId", t."saleId")
        WHERE r."organizationId" = ${scope.organizationId}::uuid AND r."storeId" = ${scope.storeId}::uuid
          AND r."receivedAt" >= ${start} AND r."receivedAt" < ${now}
      ),
      debt AS (
        SELECT currency, "customerId", "outstandingDebt", ${paymentStatus} AS status FROM "mizan"."Sale"
        WHERE ${store(scope)} AND "outstandingDebt" > 0
      ),
      new_debt AS (
        SELECT currency, GREATEST(s."defaultSettlement" - COALESCE((
          SELECT SUM(p."convertedAmount") FROM "mizan"."SalePayment" p
          WHERE (p."organizationId", p."storeId", p."saleId") =
            (s."organizationId", s."storeId", s.id) AND p.position IS NOT NULL
        ), s."convertedPayment", 0), 0) AS amount
        FROM sales s WHERE s."customerId" IS NOT NULL
      )
      SELECT
        ${saleStats("sales")} AS sales,
        ${saleStats("previous_sales")} AS "previousSales",
        (SELECT CASE WHEN count(*) = count(normalized)
          THEN SUM(normalized)::text END FROM previous_payments) AS "previousReceipts",
        (SELECT COUNT(*)::int FROM recent_intake WHERE "receivedAt" < ${previousThrough}) AS "previousIntake",
        jsonb_build_object(
          'total', ${money(Prisma.sql`${totalPayments} GROUP BY currency`)},
          'normalized', (SELECT CASE WHEN count(*) = count(normalized)
            THEN jsonb_build_object('currency', 'AZN', 'amount', COALESCE(SUM(normalized), 0)::text)
            END FROM payments),
          'repayments', ${money(Prisma.sql`${totalPayments} WHERE repayment GROUP BY currency`)},
          'tradeInCredit', ${money(Prisma.sql`SELECT currency, SUM("acceptedTradeInTotal") amount
            FROM sales WHERE "acceptedTradeInTotal" <> 0 GROUP BY currency`)},
          'payouts', ${money(Prisma.sql`SELECT currency, SUM(settlement) amount
            FROM sales WHERE settlement < 0 GROUP BY currency`)},
          'methods', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'method', m.method, 'total', ${money(Prisma.sql`${totalPayments} WHERE method = m.method GROUP BY currency`)}
          ) ORDER BY m.method) FROM (SELECT DISTINCT method FROM payments) m), '[]'::jsonb)
        ) AS payments,
        jsonb_build_object(
          'new', ${money(Prisma.sql`SELECT currency, SUM(amount) amount FROM new_debt WHERE amount > 0 GROUP BY currency`)},
          'outstanding', ${money(Prisma.sql`SELECT currency, SUM("outstandingDebt") amount FROM debt GROUP BY currency`)},
          'customers', (SELECT COUNT(DISTINCT "customerId") FROM debt),
          'partial', (SELECT COUNT(*) FROM debt WHERE status = 'PARTIALLY_PAID'),
          'unpaid', (SELECT COUNT(*) FROM debt WHERE status = 'UNPAID')
        ) AS debt,
        jsonb_build_object(
          'count', (SELECT COUNT(*) FROM intake),
          'weight', (SELECT trim_scale(COALESCE(SUM(p.weight), 0))::text FROM intake i
            JOIN "mizan"."Product" p ON p."organizationId" = ${scope.organizationId}::uuid
              AND p."storeId" = ${scope.storeId}::uuid AND p.id = i."productId"),
          'tradeInWeight', (SELECT trim_scale(COALESCE(SUM(weight), 0))::text FROM trade_ins),
          'tradeInValue', ${money(Prisma.sql`SELECT currency, SUM("acceptedValue") amount FROM trade_ins GROUP BY currency`)}
        ) AS intake,
        (SELECT jsonb_build_object('count', COUNT(*), 'weight', trim_scale(COALESCE(SUM(weight), 0))::text)
          FROM stock) AS inventory,
        (SELECT CASE WHEN COUNT(*) = COUNT("netGoldWeight")
          THEN COALESCE(SUM("netGoldWeight" * purity / 1000.0), 0)::text END
          FROM stock WHERE "metalType" = 'GOLD') AS "fineWeight"
    `,
    readGoldMarket(db, goldEnabled, now),
  ]);
  const { fineWeight, previousReceipts, previousIntake, ...summary } = row;
  const marketValue =
    fineWeight === null || market.stale || !market.quote
      ? null
      : {
          currency: "AZN",
          amount: new SaleDecimal(fineWeight)
            .times(market.quote.normalizedAznPerGram)
            .toFixed(2),
        };
  return {
    day,
    ...summary,
    comparison: {
      sales: compareMoney(summary.sales.total, summary.previousSales.total),
      saleCount: compareDay(
        summary.sales.count,
        summary.previousSales.count || null,
      ),
      receipts: compareDay(
        summary.payments.normalized?.amount ?? null,
        previousReceipts,
      ),
      intake: compareDay(summary.intake.count, previousIntake || null),
    },
    inventory: { ...summary.inventory, marketValue },
  };
}

export async function dashboardOwnerSummary(
  db: Prisma.TransactionClient,
  scope: Scope,
  now = new Date(),
): Promise<DashboardOwnerSummary> {
  const { start, previousStart, previousThrough } = dashboardWindow(now);
  const profit = (previous: boolean) => Prisma.sql`
    CASE WHEN EXISTS(SELECT 1 FROM profit WHERE previous = ${previous} AND amount IS NULL)
      THEN NULL ELSE ${money(Prisma.sql`SELECT currency, SUM(amount) amount FROM profit
        WHERE previous = ${previous} GROUP BY currency`)} END`;
  const [{ previousProfit, ...summary }] = await db.$queryRaw<
    (Omit<DashboardOwnerSummary, "grossProfitComparison"> & {
      previousProfit: DashboardOwnerSummary["grossProfit"];
    })[]
  >`
    WITH sales AS (
      SELECT *, false AS previous FROM (${scopedSales(scope, start, now)}) today
      UNION ALL
      SELECT *, true AS previous FROM (${scopedSales(scope, previousStart, previousThrough)}) yesterday
    ),
    intake AS (${intake(scope, start, now)}),
    profit AS (
      SELECT s.currency, s.previous, s."saleAmount" - costs.total AS amount
      FROM sales s CROSS JOIN LATERAL (
        SELECT CASE WHEN COUNT(*) = COUNT(*) FILTER (
          WHERE i."acquisitionCurrency" = s.currency AND i."acquisitionCost" IS NOT NULL
        ) THEN SUM(i."acquisitionCost") END AS total
        FROM "mizan"."SaleItem" i WHERE (i."organizationId", i."storeId", i."saleId") =
          (s."organizationId", s."storeId", s.id)
      ) costs
    )
    SELECT
      ${profit(false)} AS "grossProfit",
      ${profit(true)} AS "previousProfit",
      ${money(Prisma.sql`SELECT "acquisitionCurrency" currency, SUM("acquisitionCost") amount
        FROM "mizan"."Product" WHERE ${store(scope)} AND id IN (SELECT "productId" FROM intake)
        GROUP BY "acquisitionCurrency"`)} AS "intakeCost",
      ${money(Prisma.sql`SELECT "acquisitionCurrency" currency, SUM("acquisitionCost") amount
        FROM "mizan"."Product" WHERE ${store(scope)} AND status = 'IN_STOCK'
        GROUP BY "acquisitionCurrency"`)} AS "inventoryCost"
  `;
  return {
    ...summary,
    grossProfitComparison: compareMoney(summary.grossProfit, previousProfit),
  };
}

function counts(rows: Prisma.Sql) {
  return Prisma.sql`(SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'label', label, 'count', count
  ) ORDER BY count DESC, label), '[]'::jsonb) FROM (${rows}) AS counts)`;
}

export async function dashboardCharts(
  db: Prisma.TransactionClient,
  scope: Scope,
  now = new Date(),
): Promise<DashboardCharts> {
  const { day, weekStart } = dashboardWindow(now);
  const localDay = Prisma.sql`(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Baku')::date`;
  const [charts] = await db.$queryRaw<DashboardCharts[]>`
    WITH sales AS (${scopedSales(scope, weekStart, now)}),
    payments AS (${payments(scope, weekStart, now)}),
    dated_sales AS (SELECT *, ${localDay} AS day FROM sales),
    dated_payments AS (SELECT *, ${localDay} AS day FROM payments),
    sold_categories AS (
      SELECT COALESCE(i."productCategory", s."productCategory") AS label FROM sales s
      LEFT JOIN "mizan"."SaleItem" i ON (i."organizationId", i."storeId", i."saleId") =
        (s."organizationId", s."storeId", s.id)
    ),
    stock AS (SELECT category, purity FROM "mizan"."Product" WHERE ${store(scope)} AND status = 'IN_STOCK')
    SELECT
      (SELECT jsonb_agg(jsonb_build_object(
        'day', days.day::date::text,
        'sales', ${money(Prisma.sql`SELECT currency, SUM("saleAmount") amount FROM dated_sales WHERE day = days.day::date GROUP BY currency`)},
        'payments', ${money(Prisma.sql`SELECT currency, SUM(amount) amount FROM dated_payments WHERE day = days.day::date GROUP BY currency`)},
        'count', (SELECT COUNT(*) FROM dated_sales WHERE day = days.day::date)
      ) ORDER BY days.day) FROM generate_series(${day}::date - 6, ${day}::date, interval '1 day') days(day)) AS days,
      ${counts(Prisma.sql`SELECT label, COUNT(*) count FROM sold_categories GROUP BY label`)} AS categories,
      ${counts(Prisma.sql`SELECT method label, COUNT(*) count FROM payments GROUP BY method`)} AS methods,
      ${counts(Prisma.sql`SELECT purity::text label, COUNT(*) count FROM stock GROUP BY purity`)} AS purities,
      ${counts(Prisma.sql`SELECT category label, COUNT(*) count FROM stock GROUP BY category`)} AS "inventoryCategories",
      (SELECT jsonb_build_object(
        'PAID', COUNT(*) FILTER (WHERE status = 'PAID'),
        'PARTIALLY_PAID', COUNT(*) FILTER (WHERE status = 'PARTIALLY_PAID'),
        'UNPAID', COUNT(*) FILTER (WHERE status = 'UNPAID')
      ) FROM (SELECT ${paymentStatus} AS status FROM sales) statuses) AS settlement
  `;
  return charts;
}

export async function dashboardActivity(
  db: Prisma.TransactionClient,
  scope: Scope,
): Promise<DashboardActivity> {
  const [items, debtors] = await Promise.all([
    db.$queryRaw<
      (Omit<DashboardActivity["items"][number], "at"> & { at: Date })[]
    >`
      (
        SELECT id, id AS "recordId", 'sale' AS kind, "productName" AS label, "createdAt" AS at,
          jsonb_build_object('currency', currency, 'amount', "saleAmount"::text) AS value
        FROM "mizan"."Sale" WHERE ${store(scope)} ORDER BY "createdAt" DESC, id DESC LIMIT 5
      )
      UNION ALL (
        SELECT m.id, p.id, 'intake', p.name, m."createdAt", NULL::jsonb
        FROM "mizan"."InventoryMovement" m JOIN "mizan"."Product" p
          ON (p."organizationId", p."storeId", p.id) = (m."organizationId", m."storeId", m."productId")
        WHERE m."organizationId" = ${scope.organizationId}::uuid AND m."storeId" = ${scope.storeId}::uuid
          AND m.kind = 'PRODUCT_ADDED' ORDER BY m."createdAt" DESC, m.id DESC LIMIT 5
      )
      UNION ALL (
        SELECT t.id, s.id, 'tradeIn', s."productName", r."receivedAt",
          jsonb_build_object('currency', s.currency, 'amount', t."acceptedValue"::text)
        FROM "mizan"."ReceivedOldGold" r JOIN "mizan"."TradeIn" t
          ON (t."organizationId", t."storeId", t.id) = (r."organizationId", r."storeId", r."tradeInId")
        JOIN "mizan"."Sale" s ON (s."organizationId", s."storeId", s.id) = (t."organizationId", t."storeId", t."saleId")
        WHERE r."organizationId" = ${scope.organizationId}::uuid AND r."storeId" = ${scope.storeId}::uuid
        ORDER BY r."receivedAt" DESC, t.id DESC LIMIT 5
      )
      UNION ALL (
        SELECT p.id, s.id, 'repayment', COALESCE(c.name, s."productName"), p."createdAt",
          jsonb_build_object('currency', p.currency, 'amount', p.amount::text)
        FROM "mizan"."SalePayment" p JOIN "mizan"."Sale" s
          ON (s."organizationId", s."storeId", s.id) = (p."organizationId", p."storeId", p."saleId")
        LEFT JOIN "mizan"."Customer" c ON (c."organizationId", c."storeId", c.id) =
          (s."organizationId", s."storeId", s."customerId")
        WHERE p."organizationId" = ${scope.organizationId}::uuid AND p."storeId" = ${scope.storeId}::uuid
          AND p.position IS NULL ORDER BY p."createdAt" DESC, p.id DESC LIMIT 5
      )
      ORDER BY at DESC, id DESC
    `,
    db.$queryRaw<DashboardActivity["debtors"]>`
      SELECT c.id, c.name, jsonb_build_object('currency', 'AZN',
        'amount', ROUND(SUM(s."outstandingDebt" * CASE WHEN s.currency = 'AZN' THEN 1
          ELSE s."customerReportingRate" END), 2)::text) AS outstanding
      FROM "mizan"."Sale" s JOIN "mizan"."Customer" c
        ON (c."organizationId", c."storeId", c.id) = (s."organizationId", s."storeId", s."customerId")
      WHERE s."organizationId" = ${scope.organizationId}::uuid AND s."storeId" = ${scope.storeId}::uuid
        AND s."outstandingDebt" > 0
      GROUP BY c.id, c.name ORDER BY SUM(s."outstandingDebt" * CASE WHEN s.currency = 'AZN' THEN 1
        ELSE s."customerReportingRate" END) DESC, c.id LIMIT 5
    `,
  ]);
  return {
    items: items.map((item) => ({ ...item, at: item.at.toISOString() })),
    debtors,
  };
}

export async function dashboardAgedStock(
  db: Prisma.TransactionClient,
  scope: Scope,
  days: number,
  now = new Date(),
): Promise<DashboardAgedStock> {
  const cutoff = new Date(now.getTime() - days * dayMs);
  const [stock] = await db.$queryRaw<DashboardAgedStock[]>`
    WITH aged AS (
      SELECT p.id, p.name, p.code, MIN(m."createdAt") AS "receivedAt"
      FROM "mizan"."InventoryMovement" m JOIN "mizan"."Product" p
        ON (p."organizationId", p."storeId", p.id) = (m."organizationId", m."storeId", m."productId")
      WHERE m."organizationId" = ${scope.organizationId}::uuid AND m."storeId" = ${scope.storeId}::uuid
        AND m.kind = 'PRODUCT_ADDED' AND p.status = 'IN_STOCK' AND m."createdAt" <= ${cutoff}
      GROUP BY p.id, p.name, p.code
    )
    SELECT (SELECT COUNT(*)::int FROM aged) AS count,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'code', code,
        'receivedAt', to_char("receivedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY "receivedAt", id)
        FROM (SELECT * FROM aged ORDER BY "receivedAt", id LIMIT 5) oldest), '[]'::jsonb) AS items
  `;
  return stock;
}
