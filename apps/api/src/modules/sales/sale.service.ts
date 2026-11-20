import { createHash } from "node:crypto";
import type {
  SaleItem,
  SaleList,
  SaleLoss,
  SaleResult,
} from "@mizan/contracts";
import { Prisma, type createDatabase } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import { canManageAsOwner } from "../access/display-mode.js";
import { lockOrganization } from "../access/organization-owner.js";
import {
  resolveAccessContext,
  uuidPattern,
  type AccessContext,
} from "../access/access.service.js";
import { parseSaleInput } from "./sale-input.js";
import { calculateProfit } from "./profit.js";
import { requireSaleConfirmation } from "./sale-confirmation.js";
import { calculateSettlement, SaleDecimal } from "./settlement.js";

export type SalesDatabase = ReturnType<typeof createDatabase>;
const include = {
  tradeIns: { orderBy: { id: "asc" } },
  items: { orderBy: { position: "asc" } },
} as const;
type SaleRecord = Prisma.SaleGetPayload<{ include: typeof include }>;

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

function currentRates(
  db: Pick<SalesDatabase, "oldGoldRate">,
  organizationId: string,
  currency: string,
  purities?: number[],
) {
  return db.oldGoldRate.findMany({
    where: {
      organizationId,
      currency,
      grade: { active: true },
      purity: purities && { in: purities },
    },
    orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
    distinct: ["purity"],
  });
}

export async function getSaleOptions(
  db: SalesDatabase,
  context: AccessContext,
) {
  const currency = context.settings.defaultCurrency;
  const rates = await currentRates(db, context.organizationId, currency);
  return {
    currency,
    rates: rates.map(({ id, purity, amountPerGram }) => ({
      id,
      purity,
      amountPerGram: amountPerGram.toFixed(),
    })),
  };
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
  return {
    id: sale.id,
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
    payment:
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
        : null,
    product: items[0].product,
    tradeIns: sale.tradeIns.map((line) => ({
      id: line.id,
      purity: line.purity,
      rateId: line.rateId,
      weight: line.weight.toFixed(),
      appliedRate: line.appliedRate.toFixed(),
      calculatedValue: line.calculatedValue.toFixed(),
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
  filters: { q?: string; date?: string; after?: string },
): Promise<SaleList> {
  const scope = { organizationId, storeId };
  const { q, date, after } = filters;
  if (
    q !== undefined &&
    (typeof q !== "string" || q.length > 160 || q.includes("\0"))
  )
    throw new AccessError("INVALID_SALE", "q");
  let createdAt: Prisma.DateTimeFilter | undefined;
  if (date !== undefined) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new AccessError("INVALID_SALE", "date");
    const utc = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(+utc) || utc.toISOString().slice(0, 10) !== date)
      throw new AccessError("INVALID_SALE", "date");
    createdAt = {
      gte: new Date(+utc - 4 * 3600000),
      lt: new Date(+utc + 20 * 3600000),
    };
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
      AND: [
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
    take: 51,
    select: {
      id: true,
      createdAt: true,
      actorId: true,
      defaultCurrency: true,
      defaultSaleAmount: true,
      defaultSettlement: true,
      paymentCurrency: true,
      productId: true,
      productCode: true,
      productName: true,
      productCategory: true,
      productPurity: true,
      productWeight: true,
      _count: { select: { items: true } },
    },
  });
  return {
    items: rows.slice(0, 50).map((sale) => ({
      id: sale.id,
      createdAt: sale.createdAt.toISOString(),
      actorId: sale.actorId,
      currency: sale.defaultCurrency,
      saleAmount: sale.defaultSaleAmount.toFixed(),
      balance: sale.defaultSettlement.toFixed(),
      paymentCurrency: sale.paymentCurrency,
      product: productSnapshot(sale),
      itemCount: sale._count.items || 1,
    })),
    nextCursor: rows.length > 50 ? rows[49].id : undefined,
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
      await lockOrganization(tx, organizationId);
      const restricted =
        context.salespersonDisplay ||
        (sessionId &&
          (await tx.salespersonDisplaySession.findUnique({
            where: { sessionId, userId: actorId },
            select: { sessionId: true },
          })));
      const access = await resolveAccessContext(
        tx,
        restricted ? { ...context, salespersonDisplay: true } : context,
        organizationId,
        storeId,
      );
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
            organizationId,
            currency,
            input.tradeIns.map(({ purity }) => purity),
          )
        : [];
      const tradeIns = input.tradeIns.map((line) => {
        const rate = rates.find(({ purity }) => purity === line.purity);
        if (rate?.id !== line.rateId)
          throw new AccessError("SALE_CONFLICT", "rateId");
        const calculatedValue = new SaleDecimal(line.weight).times(
          rate.amountPerGram,
        );
        if (calculatedValue.gte("1e17"))
          throw new AccessError("INVALID_SALE", "weight");
        return {
          purity: line.purity,
          weight: line.weight,
          rateId: rate.id,
          appliedRate: rate.amountPerGram,
          calculatedValue: calculatedValue.toFixed(),
          acceptedValue: line.overrideAmount ?? calculatedValue.toFixed(),
          overridden: line.overrideAmount !== undefined,
        };
      });
      const settlement = calculateSettlement(
        currency,
        saleAmount,
        tradeIns.map(({ acceptedValue }) => acceptedValue),
        input.tender,
      );
      if (new SaleDecimal(settlement.tradeInTotal).gte("1e17"))
        throw new AccessError("INVALID_SALE", "tradeIns");
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
        (new SaleDecimal(settlement.balance).gt(0)
          ? {
              amount: settlement.balance,
              currency,
              exchangeRate: "1",
            }
          : undefined);
      const sale = await tx.sale.create({
        data: {
          ...key,
          requestDigest,
          productId: first.productId,
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
          productCode: first.productCode,
          productName: first.productName,
          productCategory: first.productCategory,
          productPurity: first.productPurity,
          productWeight: first.productWeight,
          items: { create: saleItems },
        },
        include: { items: include.items },
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
        const tradeIn = await tx.tradeIn.create({
          data: { ...scope, saleId: sale.id, ...line },
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
