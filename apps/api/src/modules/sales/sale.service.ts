import { createHash } from "node:crypto";
import type { SaleResult } from "@mizan/contracts";
import { Prisma, type createDatabase } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import { lockOrganization } from "../access/organization-owner.js";
import {
  resolveAccessContext,
  uuidPattern,
  type AccessContext,
} from "../access/access.service.js";
import { parseSaleInput } from "./sale-input.js";
import { calculateSettlement, SaleDecimal } from "./settlement.js";

export type SalesDatabase = ReturnType<typeof createDatabase>;
const include = { tradeIns: { orderBy: { id: "asc" } } } as const;
type SaleRecord = Prisma.SaleGetPayload<{ include: typeof include }>;

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

function presentSale(sale: SaleRecord): SaleResult {
  return {
    id: sale.id,
    actorId: sale.actorId,
    createdAt: sale.createdAt.toISOString(),
    currency: sale.defaultCurrency,
    saleAmount: sale.defaultSaleAmount.toFixed(),
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
    product: {
      id: sale.productId,
      code: sale.productCode,
      name: sale.productName,
      category: sale.productCategory,
      purity: sale.productPurity,
      weight: sale.productWeight.toFixed(),
      status: "SOLD" as const,
    },
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
  return presentSale(sale);
}

export async function recordSale(
  db: SalesDatabase,
  context: AccessContext,
  idempotencyKey: string,
  body: unknown,
) {
  const { organizationId, storeId, userId: actorId } = context;
  const scope = { organizationId, storeId };
  return db.$transaction(
    async (tx) => {
      await lockOrganization(tx, organizationId);
      const access = await resolveAccessContext(
        tx,
        context,
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
      const requestDigest = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
      if (previous) {
        if (previous.requestDigest !== requestDigest)
          throw new AccessError("SALE_CONFLICT", "idempotencyKey");
        return presentSale(previous);
      }

      const productWhere = { ...scope, id: input.productId };
      const product = await tx.product.findUnique({
        where: { organizationId_storeId_id: productWhere },
      });
      if (!product) throw new AccessError("PRODUCT_NOT_FOUND");
      const claimed = await tx.product.updateMany({
        where: { ...productWhere, status: "IN_STOCK" },
        data: { status: "SOLD" },
      });
      if (!claimed.count) throw new AccessError("SALE_CONFLICT", "productId");

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
        input.saleAmount,
        tradeIns.map(({ acceptedValue }) => acceptedValue),
        input.tender,
      );
      if (new SaleDecimal(settlement.tradeInTotal).gte("1e17"))
        throw new AccessError("INVALID_SALE", "tradeIns");
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
          productId: product.id,
          currency,
          defaultCurrency: currency,
          exchangeRate: "1",
          saleAmount: input.saleAmount,
          defaultSaleAmount: input.saleAmount,
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
          productCode: product.code,
          productName: product.name,
          productCategory: product.category,
          productPurity: product.purity,
          productWeight: product.weight,
        },
      });
      const movement = { ...scope, actorId, saleId: sale.id };
      await tx.inventoryMovement.create({
        data: { ...movement, kind: "PRODUCT_SOLD", productId: product.id },
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
      return presentSale({
        ...sale,
        tradeIns: savedLines.sort((left, right) =>
          left.id.localeCompare(right.id),
        ),
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
