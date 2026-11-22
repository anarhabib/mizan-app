import {
  goldPriceKinds,
  goldPriceModes,
  currencyMinorUnits,
  parseDecimal,
  parsePurity,
  type GoldPriceKind,
  type GoldPriceMode,
  type GoldPricingPreview,
  type StoreGoldPrice,
} from "@mizan/contracts";
import { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import {
  resolveAccessContext,
  uuidPattern,
  type AccessContext,
} from "../access/access.service.js";
import { canManageAsOwner } from "../access/display-mode.js";
import {
  ownerChange,
  type OrganizationDatabase,
} from "../access/organization-owner.js";
import { readGoldMarket } from "./gold-market.service.js";

type Scope = Pick<AccessContext, "organizationId" | "storeId">;
type Market = Awaited<ReturnType<typeof readGoldMarket>>;
type Rule = { mode: string; purity: number; amountPerGram: Prisma.Decimal };
const Decimal = Prisma.Decimal.clone({ precision: 48 });
const orderBy = [{ effectiveAt: "desc" }, { id: "desc" }] as const;

export function marketPurityRate(quote: Market["quote"], purity: number) {
  return (
    quote && new Decimal(quote.normalizedAznPerGram).times(purity).div(1000)
  );
}

export function effectiveGoldRate(rule: Rule, quote: Market["quote"]) {
  const base = marketPurityRate(quote, rule.purity);
  const value = new Decimal(rule.amountPerGram);
  const price =
    rule.mode === "FIXED"
      ? value
      : rule.mode === "PERCENTAGE"
        ? base?.times(value.div(100).plus(1))
        : base?.plus(value);
  if (!price || price.lt(0) || price.gte("100000000000000")) return null;
  return new Decimal(price.toFixed(4, Decimal.ROUND_HALF_UP));
}

export function goldValue(
  rate: Prisma.Decimal | null,
  netGoldWeight: Prisma.Decimal | null,
  currency = "AZN",
  aznPerUnit = "1",
) {
  if (!rate || !netGoldWeight) return null;
  return {
    amount: new Decimal(rate)
      .times(netGoldWeight)
      .div(aznPerUnit)
      .toFixed(currencyMinorUnits(currency), Decimal.ROUND_HALF_UP),
    currency,
  };
}

export function currentGoldRules(
  db: Prisma.TransactionClient,
  scope: Scope,
  kind: GoldPriceKind,
  purities?: number[],
) {
  return db.storeGoldPriceRule.findMany({
    where: {
      organizationId: scope.organizationId,
      storeId: scope.storeId,
      currency: "AZN",
      kind,
      purity: purities && { in: purities },
      grade: { active: true },
    },
    orderBy: [...orderBy],
    distinct: ["purity"],
  });
}

function ruleFields(
  rule: Pick<
    Prisma.StoreGoldPriceRuleGetPayload<object>,
    "id" | "purity" | "kind" | "mode" | "amountPerGram" | "effectiveAt"
  >,
) {
  return {
    id: rule.id,
    purity: rule.purity,
    kind: rule.kind as GoldPriceKind,
    mode: rule.mode as GoldPriceMode,
    value: rule.amountPerGram.toFixed(),
    effectiveAt: rule.effectiveAt.toISOString(),
  };
}

function presentRule(
  rule: Parameters<typeof ruleFields>[0],
  market: Market,
): StoreGoldPrice {
  const price = effectiveGoldRate(rule, market.stale ? null : market.quote);
  return {
    ...ruleFields(rule),
    pricePerGram: price && { amount: price.toFixed(), currency: "AZN" },
  };
}

export async function getStoreGoldRules(
  db: Prisma.TransactionClient,
  scope: Scope,
  market: Market,
) {
  const rules = await Promise.all(
    goldPriceKinds.map((kind) => currentGoldRules(db, scope, kind)),
  );
  return rules.flat().map((rule) => presentRule(rule, market));
}

function parseRule(body: unknown) {
  const raw = body as Record<string, unknown> | null;
  const purity = parsePurity(raw?.purity);
  const kind = raw?.kind === "SELL" ? "SELL" : null;
  const mode = goldPriceModes.find((mode) => mode === raw?.mode);
  const value = raw?.value;
  if (
    !kind ||
    !mode ||
    purity === null ||
    typeof value !== "string" ||
    value.length > 20
  )
    throw new AccessError("INVALID_SETTINGS");
  try {
    const magnitude = parseDecimal(
      value.startsWith("-") ? value.slice(1) : value,
      4,
    );
    if (magnitude.split(".")[0].length > 14) throw new Error("Out of range");
    const amountPerGram = new Decimal(value);
    if (mode === "FIXED" && amountPerGram.lt(0))
      throw new Error("Negative price");
    if (mode === "PERCENTAGE" && amountPerGram.lt(-100))
      throw new Error("Invalid percentage");
    return { purity, kind, mode, amountPerGram } as const;
  } catch {
    throw new AccessError("INVALID_SETTINGS", "value");
  }
}

async function previewRule(
  db: Prisma.TransactionClient,
  rule: ReturnType<typeof parseRule>,
  enabled: boolean,
): Promise<GoldPricingPreview> {
  const market =
    rule.mode === "FIXED" ? null : await readGoldMarket(db, enabled);
  if (market && (market.stale || !market.quote))
    throw new AccessError("GOLD_PRICE_UNAVAILABLE");
  const price = effectiveGoldRate(rule, market?.quote ?? null);
  if (!price) throw new AccessError("INVALID_SETTINGS", "value");
  return {
    pricePerGram: { amount: price.toFixed(), currency: "AZN" },
    ...(market?.quote && { quoteId: market.quote.id }),
  };
}

async function assertActiveGrade(
  db: Prisma.TransactionClient,
  organizationId: string,
  purity: number,
) {
  const grade = await db.purityGrade.findUnique({
    where: { organizationId_value: { organizationId, value: purity } },
    select: { active: true },
  });
  if (!grade?.active) throw new AccessError("PURITY_CONFLICT");
}

export async function previewStoreGoldPrice(
  db: Prisma.TransactionClient,
  organizationId: string,
  enabled: boolean,
  body: unknown,
) {
  const rule = parseRule(body);
  await assertActiveGrade(db, organizationId, rule.purity);
  return previewRule(db, rule, enabled);
}

export function changeStoreGoldPrice(
  db: OrganizationDatabase,
  context: AccessContext,
  enabled: boolean,
  body: unknown,
) {
  const { organizationId, storeId, userId } = context;
  return ownerChange(db, organizationId, userId, async (tx) => {
    const access = await resolveAccessContext(
      tx,
      context,
      organizationId,
      storeId,
    );
    if (!canManageAsOwner(access)) throw new AccessError("ACCESS_DENIED");
    const rule = parseRule(body);
    const { expectedPriceId, quoteId } = body as Record<string, unknown>;
    await assertActiveGrade(tx, organizationId, rule.purity);
    const [current] = await currentGoldRules(tx, context, rule.kind, [
      rule.purity,
    ]);
    if ((current?.id ?? null) !== expectedPriceId)
      throw new AccessError("GOLD_PRICE_CONFLICT");
    const preview = await previewRule(tx, rule, enabled);
    if (preview.quoteId !== quoteId)
      throw new AccessError("GOLD_PRICE_CONFLICT");
    const same =
      current?.storeId === storeId &&
      current.mode === rule.mode &&
      current.amountPerGram.equals(rule.amountPerGram);
    const saved = same
      ? current
      : await tx.storeGoldPriceRule.create({
          data: {
            ...rule,
            currency: "AZN",
            organizationId,
            storeId,
            actorId: userId,
            marketQuoteId: preview.quoteId,
            effectiveAt: new Date(
              Math.max(
                Date.now(),
                current ? current.effectiveAt.getTime() + 1 : 0,
              ),
            ),
          },
        });
    return { ...ruleFields(saved), pricePerGram: preview.pricePerGram };
  });
}

export async function getStoreGoldRuleHistory(
  db: Prisma.TransactionClient,
  scope: Scope,
  after?: string,
) {
  const where = {
    organizationId: scope.organizationId,
    storeId: scope.storeId,
  };
  if (
    after &&
    (!uuidPattern.test(after) ||
      !(await db.storeGoldPriceRule.findFirst({
        where: { ...where, id: after },
        select: { id: true },
      })))
  )
    throw new AccessError("INVALID_SETTINGS");
  const rows = await db.storeGoldPriceRule.findMany({
    where,
    orderBy: [...orderBy],
    take: 51,
    ...(after && { cursor: { id: after }, skip: 1 }),
  });
  const items = rows.slice(0, 50).map(ruleFields);
  return { items, ...(rows.length === 51 && { nextCursor: items[49].id }) };
}
