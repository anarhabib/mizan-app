import { createHash } from "node:crypto";
import { type OrganizationSettings } from "@mizan/contracts";
import type {
  SaleItem,
  SalePayment,
  SalePaymentInput,
  SaleList,
  SaleOptions,
  SaleLoss,
  SalePreview,
  SaleResult,
} from "@mizan/contracts";
import { Prisma, type createDatabase } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import { readPageSize } from "../access/page-size.js";
import { businessDateRange } from "../access/business-date.js";
import { canManageAsOwner } from "../access/display-mode.js";
import {
  lockGoldMarket,
  readGoldMarket,
} from "../gold-prices/gold-market.service.js";
import {
  activeGoldPurities,
  currentGoldRules,
  goldExchangeRate,
  resolveGoldRate,
} from "../gold-prices/store-pricing.service.js";
import { lockOrganization } from "../access/organization-owner.js";
import {
  resolveAccessContext,
  uuidPattern,
  type AccessContext,
} from "../access/access.service.js";
import {
  parsePayment,
  parseSaleInput,
  parseSalePreview,
} from "./sale-input.js";
import { calculateProfit } from "./profit.js";
import {
  pagePhotoUrls,
  type ProductPhotoStorage,
} from "../products/product.storage.js";
import { requireSaleConfirmation } from "./sale-confirmation.js";
import {
  calculateSettlement,
  calculateTradeIns,
  convertPayment,
  outstandingSaleDebt,
  paidSaleAmount,
  paymentStatus,
  SaleDecimal,
} from "./settlement.js";

export type SalesDatabase = ReturnType<typeof createDatabase>;
const include = {
  customer: { select: { name: true } },
  tradeIns: { orderBy: { id: "asc" } },
  items: { orderBy: { position: "asc" } },
  payments: {
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.SaleInclude;
type SaleRecord = Prisma.SaleGetPayload<{ include: typeof include }>;

function assertPaymentCurrency(
  settings: OrganizationSettings,
  currency: string,
  field: string,
) {
  if (
    settings.paymentCurrencies?.length &&
    !settings.paymentCurrencies.includes(currency)
  )
    throw new AccessError("INVALID_SALE", field);
}

async function resolveSaleMutationAccess(
  tx: Prisma.TransactionClient,
  context: AccessContext,
  sessionId: string | undefined,
) {
  const { organizationId, storeId, userId } = context;
  await lockOrganization(tx, organizationId);
  const restricted =
    context.salespersonDisplay ||
    (sessionId &&
      (await tx.salespersonDisplaySession.findUnique({
        where: { sessionId, userId },
        select: { sessionId: true },
      })));
  return resolveAccessContext(
    tx,
    restricted ? { ...context, salespersonDisplay: true } : context,
    organizationId,
    storeId,
  );
}

function productSnapshot(
  row: Pick<
    SaleRecord,
    | "productId"
    | "productCode"
    | "productName"
    | "productCategory"
    | "productPurity"
    | "productWeight"
  >,
): SaleResult["product"] {
  return {
    id: row.productId,
    code: row.productCode,
    name: row.productName,
    category: row.productCategory,
    purity: row.productPurity,
    weight: row.productWeight.toFixed(),
    status: "SOLD",
  };
}

async function currentRates(
  db: Prisma.TransactionClient,
  scope: Pick<AccessContext, "organizationId" | "storeId">,
  currency: string,
  requested?: number[],
  lock = false,
) {
  const active = await activeGoldPurities(db, scope.organizationId);
  const purities = requested
    ? active.filter((purity) => requested.includes(purity))
    : active;
  const rules = await currentGoldRules(db, scope, ["SCRAP_BUY"], purities);
  const relative = rules.some(({ mode }) => mode && mode !== "FIXED");
  if (lock && relative) await lockGoldMarket(db);
  const market = relative
    ? await readGoldMarket(db)
    : { quote: null, stale: true };
  const exchangeRate = rules.some(({ mode }) => mode)
    ? await goldExchangeRate(db, currency, lock)
    : undefined;
  return purities.map((purity) => {
    const { rule, rate, quoteId } = resolveGoldRate(
      rules,
      "SCRAP_BUY",
      purity,
      market,
    );
    if (rule && rate && exchangeRate) {
      const amountPerGram = new SaleDecimal(rate)
        .div(exchangeRate)
        .toDecimalPlaces(4, SaleDecimal.ROUND_HALF_UP);
      if (amountPerGram.gt(0) && amountPerGram.lt("1e14")) {
        return {
          id: rule.id,
          purity,
          amountPerGram,
          ...(quoteId && { marketQuoteId: quoteId }),
          ...(currency !== "AZN" && {
            rateExchangeRate: new SaleDecimal(exchangeRate).toFixed(),
          }),
        };
      }
    }
    return { id: null, purity, amountPerGram: null };
  });
}

export async function getSaleOptions(
  db: SalesDatabase,
  context: AccessContext,
): Promise<SaleOptions> {
  const currency = context.settings.defaultCurrency;
  const rates = await currentRates(db, context, currency);
  const purities = rates.map(({ purity }) => purity);
  const rules = await currentGoldRules(db, context, ["RETAIL_SELL"], purities);
  const market = await readGoldMarket(db);
  const exchangeRate = await goldExchangeRate(db, currency);
  return {
    currency,
    retailRates: exchangeRate
      ? purities.flatMap((purity) => {
          const { rate } = resolveGoldRate(
            rules,
            "RETAIL_SELL",
            purity,
            market,
          );
          return rate === null
            ? []
            : [
                {
                  purity,
                  amountPerGram: new SaleDecimal(rate)
                    .div(exchangeRate)
                    .toDecimalPlaces(16, SaleDecimal.ROUND_HALF_UP)
                    .toFixed(),
                },
              ];
        })
      : [],
    rates: rates.map(({ amountPerGram, ...rate }) => ({
      ...rate,
      amountPerGram: amountPerGram?.toFixed() ?? null,
    })),
  };
}

export async function previewSale(
  db: SalesDatabase,
  context: AccessContext,
  body: unknown,
): Promise<SalePreview> {
  const currency = context.settings.defaultCurrency;
  const input = parseSalePreview(body, currency);
  input.payments?.forEach((payment, index) =>
    assertPaymentCurrency(
      context.settings,
      payment.currency,
      `payments.${index}.currency`,
    ),
  );
  const rates = input.tradeIns.length
    ? await currentRates(
        db,
        context,
        currency,
        input.tradeIns.map(({ purity }) => purity),
      )
    : [];
  const tradeInPreview = calculateTradeIns(input.tradeIns, rates);
  if (!input.saleAmounts) return { currency, ...tradeInPreview };
  const saleAmount = input.saleAmounts
    .reduce((total, amount) => total.plus(amount), new SaleDecimal(0))
    .toFixed();
  const settlement = calculateSettlement(
    currency,
    saleAmount,
    tradeInPreview.tradeIns.map(({ acceptedValue }) => acceptedValue),
  );
  const due = new SaleDecimal(settlement.amountDue);
  const payments = input.payments?.map((payment, index) =>
    convertPayment(
      payment,
      currency,
      input.reportingRate!,
      `payments.${index}`,
    ),
  );
  const paid = payments ? sumPayments(payments) : due;
  return {
    currency,
    ...tradeInPreview,
    saleAmount,
    amountDue: settlement.amountDue,
    paidAmount: SaleDecimal.min(due, paid).toFixed(),
    outstandingDebt: outstandingSaleDebt(due, paid).toFixed(),
    overpayment: SaleDecimal.max(paid.minus(due), 0).toFixed(),
    ...(payments && {
      payments: payments.map(({ convertedAmount, amountAzn }) => ({
        convertedAmount,
        amountAzn,
      })),
    }),
  };
}

function sumPayments(payments: { convertedAmount: string }[]) {
  return payments.reduce(
    (total, payment) => total.plus(payment.convertedAmount),
    new SaleDecimal(0),
  );
}

function presentSale(sale: SaleRecord, access: AccessContext): SaleResult {
  const currency = sale.defaultCurrency;
  const saleAmount = sale.defaultSaleAmount.toFixed();
  const showProfit = canManageAsOwner(access);
  const rows = sale.items.length
    ? sale.items
    : [
        {
          ...sale,
          saleAmount: sale.defaultSaleAmount,
          acquisitionCost: null,
          acquisitionCostPerGram: null,
          acquisitionCurrency: null,
        },
      ];
  const items = rows.map((row): SaleItem => {
    const amount = row.saleAmount.toFixed();
    const item = { product: productSnapshot(row), saleAmount: amount };
    if (!showProfit) return item;
    return {
      ...item,
      profit: {
        ...calculateProfit(
          amount,
          currency,
          row.acquisitionCost,
          row.acquisitionCurrency,
        ),
        acquisitionCostPerGram:
          row.acquisitionCurrency && row.acquisitionCostPerGram?.gt(0)
            ? {
                amount: row.acquisitionCostPerGram.toFixed(),
                currency: row.acquisitionCurrency,
              }
            : null,
      },
    };
  });
  const costs = items.flatMap(({ profit }) =>
    profit?.acquisitionCost ? [profit.acquisitionCost] : [],
  );
  const costCurrency = costs[0]?.currency;
  const totalCost =
    costs.length === items.length &&
    costs.every(({ currency }) => currency === costCurrency)
      ? costs.reduce(
          (total, { amount }) => total.plus(amount),
          new SaleDecimal(0),
        )
      : null;
  const payment =
    sale.paymentCurrency &&
    sale.paymentAmount &&
    sale.paymentExchangeRate &&
    sale.convertedPayment &&
    sale.changeAmount
      ? {
          currency: sale.paymentCurrency,
          amount: sale.paymentAmount.toFixed(),
          exchangeRate: sale.paymentExchangeRate.toFixed(),
          convertedAmount: sale.convertedPayment.toFixed(),
          change: sale.changeAmount.toFixed(),
        }
      : null;
  const payments: SalePayment[] = sale.payments.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    kind: row.position === null ? "REPAYMENT" : "CHECKOUT",
    method: row.method as SalePaymentInput["method"],
    currency: row.currency,
    amount: row.amount.toFixed(),
    exchangeRate: row.exchangeRate.toFixed(),
    convertedAmount: row.convertedAmount.toFixed(),
    amountAzn: row.amountAzn.toFixed(2),
    change: "0",
  }));
  if (payment && !payments.some(({ kind }) => kind === "CHECKOUT")) {
    const aznRate = currency === "AZN" ? "1" : sale.customerReportingRate;
    payments.unshift({
      ...payment,
      id: sale.id,
      createdAt: sale.createdAt.toISOString(),
      kind: "CHECKOUT",
      method: null,
      amountAzn: aznRate
        ? new SaleDecimal(payment.amount)
            .times(payment.exchangeRate)
            .times(aznRate)
            .toFixed(2, SaleDecimal.ROUND_HALF_UP)
        : null,
    });
  }
  return {
    id: sale.id,
    ...(sale.customerId && { customerId: sale.customerId }),
    ...(sale.customer && { customerName: sale.customer.name }),
    outstandingDebt: sale.outstandingDebt.toFixed(),
    paymentStatus: paymentStatus(sale.defaultSettlement, sale.outstandingDebt),
    paidAmount: paidSaleAmount(sale.defaultSettlement, sale.outstandingDebt),
    payments,
    actorId: sale.actorId,
    createdAt: sale.createdAt.toISOString(),
    currency,
    saleAmount,
    items,
    ...(showProfit && {
      profit: calculateProfit(
        saleAmount,
        currency,
        totalCost,
        costCurrency ?? null,
      ),
    }),
    tradeInTotal: sale.acceptedTradeInTotal.toFixed(),
    balance: sale.defaultSettlement.toFixed(),
    payout: SaleDecimal.max(sale.defaultSettlement.negated(), 0).toFixed(),
    payment,
    product: items[0].product,
    tradeIns: sale.tradeIns.map((line) => ({
      id: line.id,
      purity: line.purity,
      rateId: line.storeGoldPriceRuleId,
      ...(line.goldMarketQuoteId && { marketQuoteId: line.goldMarketQuoteId }),
      weight: line.weight.toFixed(),
      ...(line.rateExchangeRate && {
        rateExchangeRate: line.rateExchangeRate.toFixed(),
      }),
      appliedRate: line.appliedRate?.toFixed() ?? null,
      calculatedValue: line.calculatedValue?.toFixed() ?? null,
      acceptedValue: line.acceptedValue.toFixed(),
      overridden: line.overridden,
    })),
  };
}

export async function getSale(
  db: SalesDatabase,
  context: AccessContext,
  id: string,
) {
  if (!uuidPattern.test(id)) throw new AccessError("SALE_NOT_FOUND");
  const sale = await db.sale.findUnique({
    where: {
      organizationId_storeId_id: {
        organizationId: context.organizationId,
        storeId: context.storeId,
        id,
      },
    },
    include,
  });
  if (!sale) throw new AccessError("SALE_NOT_FOUND");
  return presentSale(sale, context);
}

export async function listSales(
  db: SalesDatabase,
  { organizationId, storeId }: AccessContext,
  filters: {
    q?: string;
    date?: string;
    after?: string;
    limit?: string;
    paymentDate?: string;
    paymentStatus?: string;
    photos?: boolean;
  },
  storage?: ProductPhotoStorage,
): Promise<SaleList> {
  const pageSize = readPageSize(filters.limit, "INVALID_SALE");
  const scope = { organizationId, storeId };
  const { q, date, after } = filters;
  if (
    q !== undefined &&
    (typeof q !== "string" || q.length > 160 || q.includes("\0"))
  )
    throw new AccessError("INVALID_SALE", "q");
  const createdAt = businessDateRange(date, "INVALID_SALE", "date");
  const paymentDate = businessDateRange(
    filters.paymentDate,
    "INVALID_SALE",
    "paymentDate",
  );
  const status = filters.paymentStatus;
  let debt: Prisma.SaleWhereInput = {};
  switch (status) {
    case undefined:
      break;
    case "PAID":
      debt = { outstandingDebt: 0 };
      break;
    case "UNPAID":
      debt = {
        outstandingDebt: { gt: 0, equals: db.sale.fields.defaultSettlement },
      };
      break;
    case "PARTIALLY_PAID":
      debt = {
        outstandingDebt: { gt: 0 },
        NOT: { outstandingDebt: { equals: db.sale.fields.defaultSettlement } },
      };
      break;
    default:
      throw new AccessError("INVALID_SALE", "paymentStatus");
  }
  const cursor =
    after && typeof after === "string" && uuidPattern.test(after)
      ? await db.sale.findUnique({
          where: { organizationId_storeId_id: { ...scope, id: after } },
          select: { id: true, createdAt: true },
        })
      : undefined;
  if (after !== undefined && !cursor)
    throw new AccessError("INVALID_SALE", "after");
  const search = q?.replace(/[\\%_]/g, "\\$&");
  const reference =
    q && /^[0-9a-f]{8}$/i.test(q)
      ? {
          id: {
            gte: q + "-0000-0000-0000-000000000000",
            lte: q + "-ffff-ffff-ffff-ffffffffffff",
          },
        }
      : undefined;
  const rows = await db.sale.findMany({
    where: {
      ...scope,
      createdAt,
      ...debt,
      AND: [
        ...(paymentDate
          ? [
              {
                OR: [
                  { payments: { some: { createdAt: paymentDate } } },
                  {
                    // Legacy tender is recorded only against a positive checkout balance.
                    createdAt: paymentDate,
                    paymentCurrency: { not: null },
                    paymentAmount: { gt: 0 },
                    paymentExchangeRate: { gt: 0 },
                    defaultSettlement: { gt: 0 },
                    payments: { none: { position: { not: null } } },
                  },
                ],
              },
            ]
          : []),
        ...(search
          ? [
              {
                OR: [
                  {
                    productName: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    productCode: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    items: {
                      some: {
                        OR: [
                          {
                            productName: {
                              contains: search,
                              mode: "insensitive" as const,
                            },
                          },
                          {
                            productCode: {
                              contains: search,
                              mode: "insensitive" as const,
                            },
                          },
                        ],
                      },
                    },
                  },
                  ...(q && uuidPattern.test(q)
                    ? [{ id: q }]
                    : reference
                      ? [reference]
                      : []),
                ],
              },
            ]
          : []),
        ...(cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    select: {
      id: true,
      createdAt: true,
      actorId: true,
      defaultCurrency: true,
      defaultSaleAmount: true,
      defaultSettlement: true,
      outstandingDebt: true,
      paymentCurrency: true,
      productId: true,
      productCode: true,
      productName: true,
      productCategory: true,
      productPurity: true,
      productWeight: true,
      product:
        filters.photos && storage
          ? { select: { photoObjectKey: true } }
          : undefined,
      _count: { select: { items: true } },
    },
  });
  const page = rows.slice(0, pageSize);
  const photos = await pagePhotoUrls(
    filters.photos ? storage : undefined,
    scope,
    page.map((sale) => ({
      id: sale.productId,
      photoObjectKey: sale.product?.photoObjectKey,
    })),
  );
  return {
    items: page.map((sale) => {
      const thumbnailUrl = photos.get(sale.productId);
      return {
        id: sale.id,
        createdAt: sale.createdAt.toISOString(),
        actorId: sale.actorId,
        currency: sale.defaultCurrency,
        saleAmount: sale.defaultSaleAmount.toFixed(),
        balance: sale.defaultSettlement.toFixed(),
        outstandingDebt: sale.outstandingDebt.toFixed(),
        paymentStatus: paymentStatus(
          sale.defaultSettlement,
          sale.outstandingDebt,
        ),
        paymentCurrency: sale.paymentCurrency,
        product: productSnapshot(sale),
        itemCount: sale._count.items || 1,
        ...(thumbnailUrl && { thumbnailUrl }),
      };
    }),
    nextCursor: rows.length > pageSize ? rows[pageSize - 1].id : undefined,
  };
}

export async function recordSale(
  db: SalesDatabase,
  context: AccessContext,
  idempotencyKey: string,
  body: unknown,
  confirmation: string | undefined,
  sessionId: string | undefined,
) {
  const { organizationId, storeId, userId: actorId } = context;
  const scope = { organizationId, storeId };
  return db.$transaction(
    async (tx) => {
      const access = await resolveSaleMutationAccess(tx, context, sessionId);
      const key = { ...scope, actorId, idempotencyKey };
      const previous = await tx.sale.findUnique({
        where: { organizationId_storeId_actorId_idempotencyKey: key },
        include,
      });
      const currency =
        previous?.defaultCurrency ?? access.settings.defaultCurrency;
      const input = parseSaleInput(body, currency);
      const {
        items,
        tradeIns: requestedTradeIns,
        tender: requestedTender,
      } = input;
      // Preserve the canonical digest used by existing single-product receipts.
      const requestDigest = createHash("sha256")
        .update(
          JSON.stringify(
            items.length === 1
              ? {
                  ...items[0],
                  tradeIns: requestedTradeIns,
                  tender: requestedTender,
                  customerId: input.customerId,
                  customerReportingRate: input.customerReportingRate,
                  recordDebt: input.recordDebt,
                  payments: input.payments,
                }
              : input,
          ),
        )
        .digest("hex");
      if (previous) {
        if (previous.requestDigest !== requestDigest)
          throw new AccessError("SALE_CONFLICT", "idempotencyKey");
        return presentSale(previous, access);
      }
      input.payments?.forEach((payment, index) =>
        assertPaymentCurrency(
          access.settings,
          payment.currency,
          `payments.${index}.currency`,
        ),
      );
      if (requestedTender)
        assertPaymentCurrency(
          access.settings,
          requestedTender.currency,
          "payment.currency",
        );

      if (
        input.customerId &&
        !(await tx.customer.findUnique({
          where: {
            organizationId_storeId_id: { ...scope, id: input.customerId },
          },
          select: { id: true },
        }))
      )
        throw new AccessError("CUSTOMER_NOT_FOUND", "customerId");

      const productWhere = {
        ...scope,
        id: { in: items.map(({ productId }) => productId) },
      };
      const products = await tx.product.findMany({ where: productWhere });
      const byId = new Map(products.map((product) => [product.id, product]));
      const saleItems = items.map(({ productId, saleAmount }, position) => {
        const product = byId.get(productId);
        if (!product) throw new AccessError("PRODUCT_NOT_FOUND");
        if (product.status !== "IN_STOCK")
          throw new AccessError("SALE_CONFLICT", "productId");
        return {
          productId,
          position,
          saleAmount,
          productCode: product.code,
          productName: product.name,
          productCategory: product.category,
          productPurity: product.purity,
          productWeight: product.weight,
          acquisitionCost: product.acquisitionCost.gt(0)
            ? product.acquisitionCost
            : null,
          acquisitionCostPerGram: product.acquisitionCostPerGram,
          acquisitionCurrency: product.acquisitionCurrency,
        };
      });
      const saleAmount = items
        .reduce(
          (total, item) => total.plus(item.saleAmount),
          new SaleDecimal(0),
        )
        .toFixed();

      const rates = input.tradeIns.length
        ? await currentRates(
            tx,
            scope,
            currency,
            input.tradeIns.map(({ purity }) => purity),
            true,
          )
        : [];
      const { tradeIns } = calculateTradeIns(input.tradeIns, rates);
      const settlement = calculateSettlement(
        currency,
        saleAmount,
        tradeIns.map(({ acceptedValue }) => acceptedValue),
        input.tender,
        input.recordDebt,
      );
      const due = new SaleDecimal(settlement.amountDue);
      const payments = input.payments?.map((payment, position) => ({
        ...convertPayment(
          payment,
          currency,
          input.customerReportingRate!,
          `payments.${position}`,
        ),
        position,
        actorId,
      }));
      const paid = payments
        ? sumPayments(payments)
        : new SaleDecimal(settlement.convertedPayment);
      if (payments?.length && due.isZero())
        throw new AccessError("SALE_PAYMENT_NOT_DUE", "payments");
      if (payments && paid.gt(due))
        throw new AccessError("SALE_PAYMENT_EXCEEDS_BALANCE", "payments");
      const outstandingDebt = outstandingSaleDebt(due, paid);
      if (outstandingDebt.gt(0) && !input.customerId)
        throw new AccessError("SALE_CUSTOMER_REQUIRED", "customerId");
      const losses = saleItems.flatMap((item): SaleLoss[] => {
        const cost = item.acquisitionCost;
        return cost &&
          item.acquisitionCurrency === currency &&
          cost.gt(item.saleAmount)
          ? [
              {
                productId: item.productId,
                code: item.productCode,
                acquisitionCost: cost.toFixed(),
                saleAmount: item.saleAmount,
                expectedLoss: new SaleDecimal(cost)
                  .minus(item.saleAmount)
                  .toFixed(),
              },
            ]
          : [];
      });
      const ownerMode = canManageAsOwner(access);
      requireSaleConfirmation(
        confirmation,
        [key, sessionId, ownerMode, requestDigest],
        currency,
        losses,
        ownerMode,
        outstandingDebt.gt(0)
          ? {
              total: { amount: saleAmount, currency },
              tradeIn: { amount: settlement.tradeInTotal, currency },
              paid: { amount: paid.toFixed(), currency },
              outstanding: { amount: outstandingDebt.toFixed(), currency },
            }
          : undefined,
      );
      const claimed = await tx.product.updateMany({
        where: { ...productWhere, status: "IN_STOCK" },
        data: { status: "SOLD" },
      });
      if (claimed.count !== items.length)
        throw new AccessError("SALE_CONFLICT", "productId");
      const first = saleItems[0];
      const tender =
        input.tender ??
        (!payments && !input.recordDebt && due.gt(0)
          ? {
              amount: settlement.balance,
              currency,
              exchangeRate: "1",
            }
          : undefined);
      const cashRate = currency === "AZN" ? "1" : input.customerReportingRate;
      const checkoutPayments =
        payments ??
        (!input.tender && tender && cashRate
          ? [
              {
                ...convertPayment(
                  { ...tender, method: "CASH", exchangeRate: cashRate },
                  currency,
                  cashRate,
                  "payment",
                ),
                position: 0,
                actorId,
              },
            ]
          : []);
      const sale = await tx.sale.create({
        data: {
          ...key,
          requestDigest,
          productId: first.productId,
          customerId: input.customerId,
          customerReportingRate: input.customerReportingRate,
          currency,
          defaultCurrency: currency,
          exchangeRate: "1",
          saleAmount,
          defaultSaleAmount: saleAmount,
          acceptedTradeInTotal: settlement.tradeInTotal,
          defaultAcceptedTradeInTotal: new SaleDecimal(settlement.tradeInTotal)
            .toDecimalPlaces(4, SaleDecimal.ROUND_HALF_UP)
            .toFixed(),
          settlement: settlement.balance,
          defaultSettlement: settlement.balance,
          paymentCurrency: tender?.currency,
          paymentAmount: tender?.amount,
          paymentExchangeRate: tender?.exchangeRate,
          convertedPayment: tender && settlement.convertedPayment,
          changeAmount: tender && settlement.change,
          outstandingDebt,
          productCode: first.productCode,
          productName: first.productName,
          productCategory: first.productCategory,
          productPurity: first.productPurity,
          productWeight: first.productWeight,
          items: { create: saleItems },
          ...(checkoutPayments.length && {
            payments: { createMany: { data: checkoutPayments } },
          }),
        },
        include: {
          customer: include.customer,
          items: include.items,
          payments: include.payments,
        },
      });
      const movement = { ...scope, actorId, saleId: sale.id };
      await tx.inventoryMovement.createMany({
        data: saleItems.map(({ productId }) => ({
          ...movement,
          kind: "PRODUCT_SOLD",
          productId,
        })),
      });
      const savedLines = [];
      for (const line of tradeIns) {
        const { rateId, marketQuoteId, ...values } = line;
        const tradeIn = await tx.tradeIn.create({
          data: {
            ...scope,
            saleId: sale.id,
            ...values,
            storeGoldPriceRuleId: rateId,
            goldMarketQuoteId: marketQuoteId,
          },
        });
        savedLines.push(tradeIn);
        await tx.receivedOldGold.create({
          data: { ...scope, tradeInId: tradeIn.id },
        });
        await tx.inventoryMovement.create({
          data: {
            ...movement,
            kind: "OLD_GOLD_RECEIVED",
            tradeInId: tradeIn.id,
          },
        });
      }
      return presentSale(
        {
          ...sale,
          tradeIns: savedLines.sort((left, right) =>
            left.id.localeCompare(right.id),
          ),
        },
        access,
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function recordRepayment(
  db: SalesDatabase,
  context: AccessContext,
  saleId: string,
  idempotencyKey: string,
  body: unknown,
  sessionId: string | undefined,
) {
  if (!uuidPattern.test(saleId)) throw new AccessError("SALE_NOT_FOUND");
  const payment = parsePayment(body);
  const { organizationId, storeId, userId: actorId } = context;
  const key = { organizationId, storeId, saleId, actorId, idempotencyKey };
  const where = {
    organizationId_storeId_id: { organizationId, storeId, id: saleId },
  };
  const requestDigest = createHash("sha256")
    .update(JSON.stringify(payment))
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      const access = await resolveSaleMutationAccess(tx, context, sessionId);
      const sale = await tx.sale.findUnique({ where, include });
      if (!sale) throw new AccessError("SALE_NOT_FOUND");
      const previous = await tx.salePayment.findUnique({
        where: { organizationId_storeId_saleId_actorId_idempotencyKey: key },
        select: { requestDigest: true },
      });
      if (previous) {
        if (previous.requestDigest !== requestDigest)
          throw new AccessError("SALE_CONFLICT", "idempotencyKey");
        return presentSale(sale, access);
      }
      if (!sale.customerId || !sale.outstandingDebt.gt(0))
        throw new AccessError("SALE_PAYMENT_NOT_DUE", "payment");
      assertPaymentCurrency(
        access.settings,
        payment.currency,
        "payment.currency",
      );
      const currency = sale.defaultCurrency;
      const rate =
        currency === "AZN" ? "1" : sale.customerReportingRate?.toFixed();
      if (!rate)
        throw new AccessError("SALE_CONFLICT", "customerReportingRate");
      const converted = convertPayment(payment, currency, rate, "payment");
      if (sale.outstandingDebt.lt(converted.convertedAmount))
        throw new AccessError("SALE_PAYMENT_EXCEEDS_BALANCE", "payment.amount");
      const updated = await tx.sale.update({
        where,
        data: {
          outstandingDebt: { decrement: converted.convertedAmount },
          payments: {
            create: { ...converted, actorId, idempotencyKey, requestDigest },
          },
        },
        include,
      });
      return presentSale(updated, access);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
