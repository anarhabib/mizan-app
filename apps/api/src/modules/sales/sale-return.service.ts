import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  currencyMinorUnits,
  isBusinessDate,
  maxSaleItems,
  parseDecimal,
  salePaymentMethods,
  type SaleRefundInput,
  type SaleReturnInput,
  type SaleReturnQuote,
  type SaleReturnRecord,
} from "@mizan/contracts";
import { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import {
  actorProfile,
  uuidPattern,
  type AccessContext,
} from "../access/access.service.js";
import { resolveSaleMutationAccess } from "./sale-access.js";
import type { SalesDatabase } from "./sale.service.js";
import { SaleDecimal } from "./settlement.js";

const bakuDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Baku" });
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const dateColumn = (value: string) => new Date(value + "T00:00:00Z");
const zero = new SaleDecimal(0);
const signingKey = randomBytes(32);

export const returnHistory = {
  include: {
    items: { orderBy: { productId: "asc" } },
    debtAdjustment: true,
    actor: actorProfile,
    refunds: {
      include: { actor: actorProfile },
      orderBy: [{ refundDate: "asc" }, { id: "asc" }],
    },
  },
  orderBy: [{ returnDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
} satisfies Prisma.Sale$returnsArgs;

export const returnSummary = {
  select: {
    returnedValue: true,
    refundableValue: true,
    items: { select: { productId: true } },
    debtAdjustment: { select: { amount: true } },
    refunds: { select: { amount: true } },
  },
} satisfies Prisma.Sale$returnsArgs;

type ReturnFinance = Pick<
  Prisma.SaleGetPayload<{
    include: { payments: true; returns: typeof returnHistory };
  }>,
  | "defaultCurrency"
  | "defaultSettlement"
  | "outstandingDebt"
  | "paymentCurrency"
  | "convertedPayment"
  | "changeAmount"
  | "createdAt"
  | "payments"
  | "returns"
>;

type ReturnSummary = Prisma.SaleReturnGetPayload<typeof returnSummary>;

export function returnTotals(returns: ReturnSummary[]) {
  return returns.reduce(
    (totals, row) => ({
      value: totals.value.plus(row.returnedValue),
      canceled: totals.canceled.plus(row.debtAdjustment?.amount ?? zero),
      reserved: totals.reserved.plus(row.refundableValue),
      refunded: totals.refunded.plus(refundedAmount(row)),
    }),
    { value: zero, canceled: zero, reserved: zero, refunded: zero },
  );
}

function refundedAmount(row: Pick<ReturnSummary, "refunds">) {
  return row.refunds.reduce((sum, refund) => sum.plus(refund.amount), zero);
}

function funding(sale: ReturnFinance, through?: string) {
  const legacy = !sale.payments.some(({ position }) => position !== null);
  const initial =
    legacy &&
    sale.convertedPayment &&
    sale.paymentCurrency &&
    (!through || bakuDay.format(sale.createdAt) <= through)
      ? SaleDecimal.max(
          new SaleDecimal(sale.convertedPayment).minus(sale.changeAmount ?? 0),
          0,
        )
      : zero;
  return sale.payments.reduce(
    (funds, payment) => {
      if (through && bakuDay.format(payment.createdAt) > through) return funds;
      return {
        total: funds.total.plus(payment.convertedAmount),
        sameCurrency: funds.sameCurrency.plus(
          payment.currency === sale.defaultCurrency
            ? payment.convertedAmount
            : zero,
        ),
      };
    },
    {
      total: initial,
      sameCurrency:
        sale.paymentCurrency === sale.defaultCurrency ? initial : zero,
    },
  );
}

export function presentReturnHistory(sale: ReturnFinance): SaleReturnRecord[] {
  const capacity = SaleDecimal.max(
    funding(sale).sameCurrency.minus(returnTotals(sale.returns).refunded),
    0,
  );
  return sale.returns.map((row) => {
    const remaining = new SaleDecimal(row.refundableValue).minus(
      refundedAmount(row),
    );
    return {
      id: row.id,
      reason: row.reason,
      returnDate: dateOnly(row.returnDate),
      actorName: row.actor.membership.user.fullName,
      items: row.items.map(({ productId, resellable }) => ({
        productId,
        resellable,
      })),
      returnedValue: row.returnedValue.toFixed(),
      debtCanceled: row.debtAdjustment?.amount.toFixed() ?? "0",
      refundableValue: row.refundableValue.toFixed(),
      remainingRefundable: remaining.toFixed(),
      refundLimit: SaleDecimal.min(remaining, capacity).toFixed(),
      refunds: row.refunds.map(({ id, actor, refundDate, method, amount }) => ({
        id,
        actorName: actor.membership.user.fullName,
        refundDate: dateOnly(refundDate),
        method: method as SaleRefundInput["method"],
        amount: amount.toFixed(),
      })),
    };
  });
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AccessError("INVALID_RETURN", field);
  return value as Record<string, unknown>;
}

function amount(value: unknown, currency: string, field: string) {
  if (typeof value !== "string" || value.length > 36)
    throw new AccessError("INVALID_RETURN", field);
  try {
    return new SaleDecimal(
      parseDecimal(value, currencyMinorUnits(currency)),
    ).toFixed();
  } catch {
    throw new AccessError("INVALID_RETURN", field);
  }
}

function parseRefund(body: unknown, currency: string): SaleRefundInput {
  const input = object(body, "refund");
  const { refundDate } = input;
  if (!isBusinessDate(refundDate))
    throw new AccessError("INVALID_RETURN", "refundDate");
  const method = salePaymentMethods.find((option) => option === input.method);
  if (!method) throw new AccessError("INVALID_RETURN", "method");
  const refundAmount = amount(input.amount, currency, "amount");
  if (refundAmount === "0") throw new AccessError("INVALID_RETURN", "amount");
  return { refundDate, method, amount: refundAmount };
}

function parseReturn(body: unknown, currency: string): SaleReturnInput {
  const { items, reason, returnDate, debtCanceled, refund } = object(
    body,
    "return",
  );
  if (!isBusinessDate(returnDate))
    throw new AccessError("INVALID_RETURN", "returnDate");
  if (
    typeof reason !== "string" ||
    !reason.trim() ||
    reason.length > 600 ||
    reason.includes("\0")
  )
    throw new AccessError("INVALID_RETURN", "reason");
  if (!Array.isArray(items) || !items.length || items.length > maxSaleItems)
    throw new AccessError("INVALID_RETURN", "items");
  const selections = items
    .map((item) => {
      const { productId, resellable } = object(item, "items");
      if (
        typeof productId !== "string" ||
        !uuidPattern.test(productId) ||
        typeof resellable !== "boolean"
      )
        throw new AccessError("INVALID_RETURN", "items");
      return { productId: productId.toLowerCase(), resellable };
    })
    .sort((a, b) => a.productId.localeCompare(b.productId));
  if (
    new Set(selections.map(({ productId }) => productId)).size !==
    selections.length
  )
    throw new AccessError("INVALID_RETURN", "items");
  return {
    items: selections,
    reason: reason.trim(),
    returnDate,
    debtCanceled:
      debtCanceled === undefined
        ? undefined
        : amount(debtCanceled, currency, "debtCanceled"),
    refund: refund === undefined ? undefined : parseRefund(refund, currency),
  };
}

async function readSale(
  tx: Prisma.TransactionClient,
  access: AccessContext,
  id: string,
) {
  if (!uuidPattern.test(id)) throw new AccessError("SALE_NOT_FOUND");
  const { organizationId, storeId } = access;
  const sale = await tx.sale.findUnique({
    where: { organizationId_storeId_id: { organizationId, storeId, id } },
    include: {
      items: { include: { product: { select: { status: true } } } },
      product: { select: { status: true } },
      payments: true,
      returns: returnHistory,
      movements: {
        where: { kind: "PRODUCT_SOLD" },
        select: { productId: true },
      },
    },
  });
  if (!sale) throw new AccessError("SALE_NOT_FOUND");
  return sale;
}

export function hasLegacyReturnSnapshot(sale: {
  productId: string;
  jewelrySetId: string | null;
  movements: { productId: string | null }[];
}) {
  // Legacy receipts may have no inventory event. If present, it must identify
  // exactly the same single product as the receipt header.
  return (
    !sale.jewelrySetId &&
    (sale.movements.length === 0 ||
      (sale.movements.length === 1 &&
        sale.movements[0].productId === sale.productId))
  );
}

function assertDate(day: string, earliest: string, field: string) {
  if (day < earliest || day > bakuDay.format(new Date()))
    throw new AccessError("INVALID_RETURN", field);
}

function checkRefund(
  sale: ReturnFinance,
  refund: SaleRefundInput,
  minDate: string,
  liability: Prisma.Decimal,
) {
  assertDate(refund.refundDate, minDate, "refundDate");
  const capacity = funding(sale, refund.refundDate).sameCurrency.minus(
    returnTotals(sale.returns).refunded,
  );
  if (liability.lt(refund.amount) || capacity.lt(refund.amount))
    throw new AccessError("REFUND_EXCEEDS_BALANCE", "amount");
}

function assess(
  sale: Awaited<ReturnType<typeof readSale>>,
  input: SaleReturnInput,
) {
  const latestReturn = sale.returns.at(-1);
  assertDate(
    input.returnDate,
    [
      bakuDay.format(sale.createdAt),
      latestReturn ? dateOnly(latestReturn.returnDate) : "",
      ...sale.payments.map(({ createdAt }) => bakuDay.format(createdAt)),
    ]
      .sort()
      .at(-1)!,
    "returnDate",
  );
  const rows = sale.items.length
    ? sale.items
    : hasLegacyReturnSnapshot(sale)
      ? [{ ...sale, position: null, saleAmount: sale.defaultSaleAmount }]
      : [];
  if (
    !rows.length ||
    !rows
      .reduce((sum, row) => sum.plus(row.saleAmount), zero)
      .eq(sale.defaultSaleAmount)
  )
    throw new AccessError("RETURN_CONFLICT", "items");
  const returned = new Set(
    sale.returns.flatMap(({ items }) =>
      items.map(({ productId }) => productId),
    ),
  );
  const available = rows.filter(({ productId }) => !returned.has(productId));
  const selected = input.items.map(({ productId, resellable }) => {
    const row = available.find(
      (candidate) => candidate.productId === productId,
    );
    if (!row || row.product.status !== "SOLD")
      throw new AccessError("RETURN_CONFLICT", "items");
    return {
      productId,
      resellable,
      snapshotProductId: row.position === null ? null : productId,
      value: row.saleAmount,
    };
  });
  const value = selected.reduce((sum, row) => sum.plus(row.value), zero);
  const totals = returnTotals(sale.returns);
  const debt = new SaleDecimal(sale.outstandingDebt);
  const collected = SaleDecimal.max(
    new SaleDecimal(sale.defaultSettlement).minus(debt).minus(totals.canceled),
    0,
  );
  const availableCash = SaleDecimal.max(
    SaleDecimal.min(collected, funding(sale).total).minus(totals.reserved),
    0,
  );
  const min = SaleDecimal.max(value.minus(availableCash), 0);
  const max = SaleDecimal.min(value, debt);
  if (min.gt(max))
    throw new AccessError(
      sale.acceptedTradeInTotal.gt(0) ? "RETURN_TRADE_IN" : "RETURN_CONFLICT",
      "items",
    );
  const canceled =
    input.debtCanceled === undefined
      ? min.eq(max)
        ? min
        : null
      : new SaleDecimal(input.debtCanceled);
  if (canceled && (canceled.lt(min) || canceled.gt(max)))
    throw new AccessError("INVALID_RETURN", "debtCanceled");
  const liability = canceled ? value.minus(canceled) : null;
  if (input.refund) {
    if (!liability) throw new AccessError("INVALID_RETURN", "debtCanceled");
    checkRefund(sale, input.refund, input.returnDate, liability);
  }
  const quote: SaleReturnQuote = {
    currency: sale.defaultCurrency,
    returnedValue: value.toFixed(),
    collected: collected.toFixed(),
    minDebtCanceled: min.toFixed(),
    maxDebtCanceled: max.toFixed(),
    debtCanceled: canceled?.toFixed() ?? null,
    remainingDebt: canceled ? debt.minus(canceled).toFixed() : null,
    refundableValue: liability?.toFixed() ?? null,
    refundLimit: liability
      ? SaleDecimal.min(
          liability,
          SaleDecimal.max(funding(sale).sameCurrency.minus(totals.refunded), 0),
        ).toFixed()
      : null,
    refundAmount: input.refund?.amount ?? "0",
    remainingRefundable:
      liability?.minus(input.refund?.amount ?? "0").toFixed() ?? null,
    remainingProductIds: available
      .map(({ productId }) => productId)
      .filter((id) => !selected.some(({ productId }) => productId === id))
      .sort(),
  };
  return { quote, selected };
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function confirmation(
  access: AccessContext,
  saleId: string,
  input: SaleReturnInput,
  quote: SaleReturnQuote,
) {
  const { organizationId, storeId, userId } = access;
  return createHmac("sha256", signingKey)
    .update(
      JSON.stringify([organizationId, storeId, userId, saleId, input, quote]),
    )
    .digest("base64url");
}

export async function previewReturn(
  db: SalesDatabase,
  access: AccessContext,
  id: string,
  body: unknown,
) {
  return db.$transaction(
    async (tx) => {
      const sale = await readSale(tx, access, id);
      const input = parseReturn(body, sale.defaultCurrency);
      const { quote } = assess(sale, input);
      return {
        ...quote,
        ...(quote.debtCanceled !== null && {
          confirmation: confirmation(access, sale.id, input, quote),
        }),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

function refundData(
  refund: SaleRefundInput,
  currency: string,
  key: {
    actorId: string;
    idempotencyKey: string;
    requestDigest: string;
  },
  createdAt = new Date(),
) {
  return {
    ...refund,
    ...key,
    currency,
    createdAt,
    refundDate: dateColumn(refund.refundDate),
  };
}

export async function recordReturn(
  db: SalesDatabase,
  context: AccessContext,
  id: string,
  body: unknown,
  token: unknown,
  idempotencyKey: string,
  sessionId?: string,
) {
  return db.$transaction(
    async (tx) => {
      const access = await resolveSaleMutationAccess(tx, context, sessionId);
      const sale = await readSale(tx, access, id);
      const input = parseReturn(body, sale.defaultCurrency);
      const { organizationId, storeId, userId: actorId } = access;
      const scope = { organizationId, storeId };
      const key = { ...scope, actorId, idempotencyKey };
      const requestDigest = digest([sale.id, input]);
      const previous = await tx.saleReturn.findUnique({
        where: { organizationId_storeId_actorId_idempotencyKey: key },
      });
      if (previous) {
        if (previous.requestDigest !== requestDigest)
          throw new AccessError("RETURN_CONFLICT", "idempotencyKey");
        return { id: previous.id };
      }
      const { quote, selected } = assess(sale, input);
      if (
        quote.debtCanceled === null ||
        quote.refundableValue === null ||
        token !== confirmation(access, sale.id, input, quote)
      )
        throw new AccessError("RETURN_CONFLICT", "confirmation");
      const createdAt = new Date();
      const saved = await tx.saleReturn.create({
        data: {
          ...key,
          saleId: sale.id,
          requestDigest,
          createdAt,
          reason: input.reason,
          returnDate: dateColumn(input.returnDate),
          currency: quote.currency,
          returnedValue: quote.returnedValue,
          refundableValue: quote.refundableValue,
          items: {
            createMany: {
              data: selected.map(({ value: _value, ...row }) => row),
            },
          },
          ...(quote.debtCanceled !== "0" && {
            debtAdjustment: { create: { amount: quote.debtCanceled } },
          }),
          ...(input.refund && {
            refunds: {
              create: refundData(
                input.refund,
                quote.currency,
                {
                  actorId,
                  idempotencyKey: "return:" + digest(idempotencyKey),
                  requestDigest,
                },
                createdAt,
              ),
            },
          }),
        },
        select: { id: true },
      });
      if (quote.debtCanceled !== "0")
        await tx.sale.update({
          where: { organizationId_storeId_id: { ...scope, id: sale.id } },
          data: { outstandingDebt: { decrement: quote.debtCanceled } },
        });
      for (const resellable of [true, false]) {
        const ids = selected
          .filter((row) => row.resellable === resellable)
          .map(({ productId }) => productId);
        if (!ids.length) continue;
        const updated = await tx.product.updateMany({
          where: { ...scope, id: { in: ids }, status: "SOLD" },
          data: { status: resellable ? "IN_STOCK" : "UNAVAILABLE" },
        });
        if (updated.count !== ids.length)
          throw new AccessError("RETURN_CONFLICT", "items");
      }
      await tx.inventoryMovement.createMany({
        data: selected.map(({ productId }) => ({
          ...scope,
          actorId,
          productId,
          saleId: sale.id,
          returnSaleId: sale.id,
          kind: "PRODUCT_RETURNED",
          createdAt,
        })),
      });
      return saved;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function recordRefund(
  db: SalesDatabase,
  context: AccessContext,
  id: string,
  returnId: string,
  body: unknown,
  idempotencyKey: string,
  sessionId?: string,
) {
  if (!uuidPattern.test(returnId)) throw new AccessError("SALE_NOT_FOUND");
  return db.$transaction(
    async (tx) => {
      const access = await resolveSaleMutationAccess(tx, context, sessionId);
      const sale = await readSale(tx, access, id);
      const row = sale.returns.find(
        (item) => item.id === returnId.toLowerCase(),
      );
      if (!row) throw new AccessError("SALE_NOT_FOUND");
      const refund = parseRefund(body, row.currency);
      const { organizationId, storeId, userId: actorId } = access;
      const key = {
        organizationId,
        storeId,
        actorId,
        idempotencyKey: "refund:" + idempotencyKey,
      };
      const requestDigest = digest([row.id, refund]);
      const previous = await tx.saleRefund.findUnique({
        where: { organizationId_storeId_actorId_idempotencyKey: key },
      });
      if (previous) {
        if (previous.requestDigest !== requestDigest)
          throw new AccessError("RETURN_CONFLICT", "idempotencyKey");
        return { id: previous.id };
      }
      checkRefund(
        sale,
        refund,
        dateOnly(row.returnDate),
        new SaleDecimal(row.refundableValue).minus(refundedAmount(row)),
      );
      return tx.saleRefund.create({
        data: {
          organizationId,
          storeId,
          returnId: row.id,
          ...refundData(refund, row.currency, { ...key, requestDigest }),
        },
        select: { id: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
