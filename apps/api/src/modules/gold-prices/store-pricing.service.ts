import { createHash } from "node:crypto";
import {
  currencyMinorUnits,
  goldPriceKinds,
  goldPriceModes,
  officialRateCurrencies,
  parseDecimal,
  parsePurity,
  type GoldEffectiveRate,
  type GoldPriceKind,
  type GoldPricingPreview,
  type GoldRateWarning,
  type StoreGoldPriceRule,
} from "@mizan/contracts";
import { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import { readPageSize } from "../access/page-size.js";
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
import { presentExchangeRates } from "../exchange-rates/exchange-rates.service.js";
import { lockGoldMarket, readGoldMarket } from "./gold-market.service.js";

type Scope = Pick<AccessContext, "organizationId" | "storeId">;
type Market = Awaited<ReturnType<typeof readGoldMarket>>;
type Rule = Pick<
  Prisma.StoreGoldPriceRuleGetPayload<object>,
  "id" | "kind" | "mode" | "value" | "purity" | "effectiveAt" | "actorId"
>;
type Configuration = Pick<Rule, "kind" | "mode" | "value">;
const Decimal = Prisma.Decimal.clone({ precision: 48 });
const orderBy = [{ effectiveAt: "desc" }, { id: "desc" }] as const;
const maxRate = "100000000000000";

export function marketPurityRate(quote: Market["quote"], purity: number) {
  return (
    quote && new Decimal(quote.normalizedAznPerGram).times(purity).div(1000)
  );
}

export function effectiveGoldRate(
  rule: Configuration,
  quote: Market["quote"],
  purity: number,
) {
  if (!rule.mode || !rule.value) return null;
  const base = marketPurityRate(quote, purity);
  const value = new Decimal(rule.value);
  const price =
    rule.mode === "FIXED"
      ? value
      : rule.mode === "PERCENTAGE"
        ? base?.times(value.div(100).plus(1))
        : base?.plus(value);
  if (!price || price.lt(0)) return null;
  const rounded = price.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  return rounded.gte(maxRate) ||
    (rounded.isZero() && rule.kind !== "RETAIL_SELL")
    ? null
    : rounded;
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

export async function goldExchangeRate(
  db: Prisma.TransactionClient,
  currency: string,
  lock = false,
) {
  if (currency === "AZN") return "1";
  const official = officialRateCurrencies.find((code) => code === currency);
  if (!official) return undefined;
  if (lock)
    await db.$queryRaw`SELECT "source" FROM "mizan"."OfficialExchangeRateSnapshot" WHERE "source" = 'CBAR' FOR SHARE`;
  const exchange = presentExchangeRates(
    await db.officialExchangeRateSnapshot.findUnique({
      where: { source: "CBAR" },
    }),
    new Date(),
  );
  return exchange.stale ? undefined : exchange.snapshot?.rates[official];
}

export function currentGoldRules(
  db: Prisma.TransactionClient,
  scope: Scope,
  kinds: readonly GoldPriceKind[],
  purities: readonly number[],
  before?: Date,
) {
  const kindFilter = Prisma.join(
    kinds.map((kind) => Prisma.sql`${kind}::"mizan"."GoldPriceKind"`),
  );
  const purityFilter = purities.length
    ? Prisma.sql`OR "purity" IN (${Prisma.join(purities)})`
    : Prisma.empty;
  const timeFilter = before
    ? Prisma.sql`AND "effectiveAt" < ${before}`
    : Prisma.empty;
  return db.$queryRaw<Rule[]>`
    SELECT DISTINCT ON ("kind", "purity") "id", "kind", "mode", "value", "purity", "effectiveAt", "actorId"
    FROM "mizan"."StoreGoldPriceRule"
    WHERE "organizationId" = ${scope.organizationId}::uuid
      AND "storeId" = ${scope.storeId}::uuid
      AND "kind" IN (${kindFilter})
      AND ("purity" IS NULL ${purityFilter})
      ${timeFilter}
    ORDER BY "kind", "purity", "effectiveAt" DESC, "id" DESC
  `;
}

export function activeGoldPurities(
  db: Prisma.TransactionClient,
  organizationId: string,
) {
  return db.purityGrade
    .findMany({
      where: { organizationId, active: true },
      select: { value: true },
      orderBy: { value: "asc" },
    })
    .then((grades) => grades.map(({ value }) => value));
}

export function resolveGoldRate(
  rules: readonly Rule[],
  kind: GoldPriceKind,
  purity: number,
  market: Market,
) {
  const individual = rules.find(
    (rule) => rule.kind === kind && rule.purity === purity,
  );
  const defaultRule = rules.find(
    (rule) => rule.kind === kind && rule.purity === null,
  );
  const rule = individual?.mode ? individual : defaultRule;
  const quote = market.stale ? null : market.quote;
  const usesMarket = rule ? rule.mode !== "FIXED" : kind === "RETAIL_SELL";
  const rate = rule
    ? effectiveGoldRate(rule, quote, purity)
    : usesMarket
      ? marketPurityRate(quote, purity)
      : null;
  const source = rule
    ? rule.purity === null
      ? "DEFAULT"
      : "INDIVIDUAL"
    : usesMarket
      ? "MARKET"
      : null;
  return {
    rule,
    rate,
    source,
    status: rate
      ? "CURRENT"
      : usesMarket && market.quote && market.stale
        ? "STALE"
        : "UNAVAILABLE",
    quoteId: usesMarket ? quote?.id : undefined,
  } as const;
}

function configuration(rule: Pick<Rule, "mode" | "value"> | null) {
  return rule?.mode && rule.value
    ? { mode: rule.mode, value: rule.value.toFixed() }
    : null;
}

function ruleFields(rule: Rule): StoreGoldPriceRule {
  return {
    id: rule.id,
    purity: rule.purity,
    kind: rule.kind,
    configuration: configuration(rule),
    effectiveAt: rule.effectiveAt.toISOString(),
    actorId: rule.actorId,
  };
}

function priceRows(
  rules: Rule[],
  purity: number,
  market: Market,
): GoldEffectiveRate[] {
  const resolved = goldPriceKinds.map((kind) => ({
    kind,
    ...resolveGoldRate(rules, kind, purity, market),
  }));
  const buy = resolved.find(({ kind }) => kind === "SCRAP_BUY")?.rate;
  const sell = resolved.find(({ kind }) => kind === "SCRAP_SELL")?.rate;
  const reference = market.stale
    ? null
    : marketPurityRate(market.quote, purity);
  return resolved.map(({ kind, rule, rate, source, status }) => {
    const warnings: GoldRateWarning[] = [];
    if (kind !== "RETAIL_SELL" && buy && sell && buy.gt(sell))
      warnings.push("SCRAP_SPREAD");
    // A half/double reference signals a price equivalent to half/double the actual metal content.
    if (
      rule &&
      rate &&
      reference &&
      (rate.lt(reference.div(2)) || rate.gt(reference.times(2)))
    )
      warnings.push("MARKET_DEVIATION");
    return {
      kind,
      pricePerGram: rate && { amount: rate.toFixed(), currency: "AZN" },
      mode: rule?.mode ?? undefined,
      source,
      status,
      warnings,
    };
  });
}

export async function getStoreGoldRules(
  db: Prisma.TransactionClient,
  scope: Scope,
  market: Market,
  purities: number[],
) {
  const rules = await currentGoldRules(db, scope, goldPriceKinds, purities);
  return {
    rules: rules.filter(({ mode }) => mode !== null).map(ruleFields),
    rates: purities.map((purity) => ({
      purity,
      prices: priceRows(rules, purity, market),
    })),
  };
}

function parseRule(body: unknown) {
  const raw = (body ?? {}) as Record<string, unknown>;
  const purity = raw.purity === null ? null : parsePurity(raw.purity);
  const kind = goldPriceKinds.find((kind) => kind === raw.kind);
  if (
    !kind ||
    (purity === null && raw.purity !== null) ||
    (raw.currency !== undefined && raw.currency !== "AZN")
  )
    throw new AccessError("INVALID_SETTINGS");
  if (
    raw.reset === true &&
    purity !== null &&
    raw.mode === undefined &&
    raw.value === undefined
  )
    return { purity, kind, mode: null, value: null };
  const mode = goldPriceModes.find((mode) => mode === raw.mode);
  const value = raw.value;
  if (
    raw.reset !== undefined ||
    !mode ||
    typeof value !== "string" ||
    value.length > 20
  )
    throw new AccessError("INVALID_SETTINGS");
  try {
    const magnitude = parseDecimal(value.replace(/^[+-]/, ""), 4);
    if (magnitude.split(".")[0].length > 14) throw new Error("Out of range");
    const decimal = new Decimal(value);
    if (
      mode === "FIXED" &&
      !effectiveGoldRate({ kind, mode, value: decimal }, null, 1)
    )
      throw new Error("Invalid fixed price");
    if (
      mode === "PERCENTAGE" &&
      (decimal.lt(-100) || (kind !== "RETAIL_SELL" && decimal.eq(-100)))
    )
      throw new Error("Invalid percentage");
    return { purity, kind, mode, value: decimal };
  } catch {
    throw new AccessError("INVALID_SETTINGS", "value");
  }
}

async function prepareRule(
  db: Prisma.TransactionClient,
  scope: Scope,
  enabled: boolean,
  draft: ReturnType<typeof parseRule>,
  lock = false,
) {
  const { purity, kind, mode } = draft;
  const active = await activeGoldPurities(db, scope.organizationId);
  if (purity !== null && !active.includes(purity))
    throw new AccessError("PURITY_CONFLICT");
  const purities = purity === null ? active : [purity];
  const rules = await currentGoldRules(db, scope, goldPriceKinds, purities);
  const current = rules.find(
    (rule) => rule.kind === kind && rule.purity === purity,
  );
  const inherited = rules.find(
    (rule) => rule.kind === kind && rule.purity === null,
  );
  const previous = current?.mode ? current : inherited;
  if (!mode && !current?.mode) throw new AccessError("GOLD_PRICE_CONFLICT");
  const relative = mode
    ? mode !== "FIXED"
    : inherited
      ? inherited.mode !== "FIXED"
      : kind === "RETAIL_SELL";
  if (lock && relative) await lockGoldMarket(db);
  const market = await readGoldMarket(db, enabled);
  if (mode && relative && (market.stale || !market.quote))
    throw new AccessError("GOLD_PRICE_UNAVAILABLE");

  const replacement = {
    ...draft,
    id: "",
    actorId: "",
    effectiveAt: new Date(0),
  };
  const projected = rules.filter(
    (rule) => rule.kind !== kind || rule.purity !== purity,
  );
  if (mode) projected.push(replacement);
  const affected = purities.filter(
    (grade) =>
      purity !== null ||
      !rules.some(
        (rule) => rule.kind === kind && rule.purity === grade && rule.mode,
      ),
  );
  const rates = affected.map((grade) => ({
    purity: grade,
    ...priceRows(projected, grade, market).find(
      (price) => price.kind === kind,
    )!,
  }));
  if (mode && rates.some(({ pricePerGram }) => !pricePerGram))
    throw new AccessError("INVALID_SETTINGS", "value");
  const revision = createHash("sha256")
    .update(
      JSON.stringify([
        scope.organizationId,
        scope.storeId,
        kind,
        purity,
        configuration(draft),
        purities,
        rules
          .filter((rule) => rule.kind === kind)
          .map(({ purity, id }) => [purity, id]),
      ]),
    )
    .digest("hex");
  const preview: GoldPricingPreview = {
    rates,
    expectedPriceId: previous?.id ?? null,
    revision,
    ...(relative &&
      !market.stale &&
      market.quote && { quoteId: market.quote.id }),
  };
  return { preview, current };
}

export async function previewStoreGoldPrice(
  db: Prisma.TransactionClient,
  scope: Scope,
  enabled: boolean,
  body: unknown,
) {
  return (await prepareRule(db, scope, enabled, parseRule(body))).preview;
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
    const { expectedPriceId, revision, quoteId, confirmFixedDefault } =
      body as Record<string, unknown>;
    if (
      rule.purity === null &&
      rule.mode === "FIXED" &&
      confirmFixedDefault !== true
    )
      throw new AccessError("INVALID_SETTINGS");
    const { preview, current } = await prepareRule(
      tx,
      context,
      enabled,
      rule,
      true,
    );
    if (
      preview.expectedPriceId !== expectedPriceId ||
      preview.revision !== revision ||
      preview.quoteId !== quoteId
    )
      throw new AccessError("GOLD_PRICE_CONFLICT");
    if (
      rule.mode &&
      current?.mode === rule.mode &&
      current.value?.equals(rule.value!)
    )
      return ruleFields(current);
    const saved = await tx.storeGoldPriceRule.create({
      data: {
        ...rule,
        organizationId,
        storeId,
        actorId: userId,
        previousId: current?.id,
        marketQuoteId:
          rule.mode && rule.mode !== "FIXED" ? preview.quoteId : undefined,
        effectiveAt: new Date(
          Math.max(Date.now(), current ? current.effectiveAt.getTime() + 1 : 0),
        ),
      },
    });
    return ruleFields(saved);
  });
}

export async function getStoreGoldRuleHistory(
  db: Prisma.TransactionClient,
  scope: Scope,
  after?: string,
  limit?: string,
) {
  const pageSize = readPageSize(limit, "INVALID_SETTINGS");
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
    take: pageSize + 1,
    include: {
      previous: { select: { mode: true, value: true } },
      actor: { select: { user: { select: { fullName: true } } } },
    },
    ...(after && { cursor: { id: after }, skip: 1 }),
  });
  const items = rows.slice(0, pageSize).map((row) => ({
    ...ruleFields(row),
    actorName: row.actor.user.fullName,
    previous: configuration(row.previous),
  }));
  return {
    items,
    ...(rows.length > pageSize && { nextCursor: items[pageSize - 1].id }),
  };
}
