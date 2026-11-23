import {
  goldPriceKinds,
  officialRateCurrencies,
  type DashboardGoldHistory,
  type DashboardGoldRates,
  type GoldPriceKind,
  type MarketMovement,
  type MarketPeriod,
  type MarketSeries,
  type OfficialRateHistory,
} from "@mizan/contracts";
import type { Prisma } from "@mizan/database";
import type { AccessContext } from "../access/access.service.js";
import { goldMarketSource } from "../gold-prices/gold-api.js";
import {
  maxQuoteAgeMs,
  presentQuote,
  readGoldMarket,
} from "../gold-prices/gold-market.service.js";
import {
  currentGoldRules,
  marketPurityRate,
  resolveGoldRate,
} from "../gold-prices/store-pricing.service.js";
import { SaleDecimal } from "../sales/settlement.js";

const day = 86_400_000;
const duration: Record<MarketPeriod, number> = {
  "24h": day,
  "7d": 7 * day,
  "30d": 30 * day,
  "90d": 90 * day,
};
type Scope = Pick<AccessContext, "organizationId" | "storeId">;
type Market = Awaited<ReturnType<typeof readGoldMarket>>;
type Observation = {
  at: Date;
  value: Prisma.Decimal | null;
  ruleChange?: boolean;
};

export function marketMovement(
  first: Prisma.Decimal,
  last: Prisma.Decimal,
): MarketMovement | null {
  if (first.isZero() && !last.isZero()) return null;
  const change = new SaleDecimal(last).minus(first);
  return {
    absolute: change.toFixed(),
    percent: first.isZero() ? "0" : change.div(first).times(100).toFixed(2),
    direction:
      change.isPositive() && !change.isZero()
        ? "up"
        : change.isNegative()
          ? "down"
          : "flat",
  };
}

export function summarizeMarketSeries(
  observations: Observation[],
  period: MarketPeriod,
): MarketSeries {
  const bucketMs = duration[period] / 180;
  const buckets = new Map<number, Observation>();
  const keyPoints = new Set<Observation>();
  let first: Prisma.Decimal | null = null;
  let last: Prisma.Decimal | null = null;
  let low: Prisma.Decimal | null = null;
  let high: Prisma.Decimal | null = null;
  let count = 0;
  for (const [index, point] of observations.entries()) {
    const { value } = point;
    buckets.set(Math.floor(point.at.getTime() / bucketMs), point);
    const previous = observations[index - 1];
    if (
      point.ruleChange ||
      (previous && (previous.value === null) !== (value === null))
    ) {
      if (previous) keyPoints.add(previous);
      keyPoints.add(point);
    }
    if (value === null) continue;
    first ??= value;
    last = value;
    low = low === null || value.lt(low) ? value : low;
    high = high === null || value.gt(high) ? value : high;
    count++;
  }
  if (observations.length) keyPoints.add(observations[0]);
  const points = [...new Set([...keyPoints, ...buckets.values()])]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ at, value }) => ({
      at: at.toISOString(),
      value: value?.toFixed() ?? null,
    }));
  return {
    points,
    high: high?.toFixed() ?? null,
    low: low?.toFixed() ?? null,
    movement:
      count > 1 && first && last && observations.at(-1)?.value
        ? marketMovement(first, last)
        : null,
  };
}

function quotes(db: Prisma.TransactionClient, start: Date, end: Date) {
  return db.goldMarketQuote.findMany({
    where: { source: goldMarketSource, effectiveAt: { gte: start, lte: end } },
    orderBy: [
      { effectiveAt: "asc" },
      { firstRetrievedAt: { sort: "asc", nulls: "first" } },
      { id: "asc" },
    ],
  });
}

function uniqueQuoteTimes<T extends { effectiveAt: Date }>(rows: T[]) {
  const observations = new Map(
    rows.map((row) => [row.effectiveAt.getTime(), row]),
  );
  return [...observations.values()];
}

export async function dashboardGoldHistory(
  db: Prisma.TransactionClient,
  period: MarketPeriod,
  purity: number | undefined,
  now = new Date(),
): Promise<DashboardGoldHistory> {
  const rows = uniqueQuoteTimes(
    await quotes(db, new Date(now.getTime() - duration[period]), now),
  );
  return {
    usd: summarizeMarketSeries(
      rows.map((row) => ({
        at: row.effectiveAt,
        value: row.usdPerTroyOunce,
      })),
      period,
    ),
    azn: summarizeMarketSeries(
      purity === undefined
        ? []
        : rows.map((row) => ({
            at: row.effectiveAt,
            value: new SaleDecimal(row.aznPerGram).times(purity).div(1000),
          })),
      period,
    ),
  };
}

export async function dashboardGoldRates(
  db: Prisma.TransactionClient,
  scope: Scope,
  market: Market,
  purities: number[],
): Promise<DashboardGoldRates> {
  const rules = await currentGoldRules(db, scope, goldPriceKinds, purities);
  const price = (value: Prisma.Decimal | null) =>
    value === null ? null : { currency: "AZN", amount: value.toFixed() };
  return {
    stale: market.stale,
    quoteId: market.quote?.id ?? null,
    rates: purities.map((purity) => {
      const retail = resolveGoldRate(rules, "RETAIL_SELL", purity, market);
      return {
        purity,
        reference: price(
          marketPurityRate(market.stale ? null : market.quote, purity),
        ),
        commercial: {
          RETAIL_SELL: price(retail.rate),
          SCRAP_BUY: price(
            resolveGoldRate(rules, "SCRAP_BUY", purity, market).rate,
          ),
          SCRAP_SELL: price(
            resolveGoldRate(rules, "SCRAP_SELL", purity, market).rate,
          ),
        },
        retailStatus: retail.status,
      };
    }),
  };
}

export async function dashboardStoreRateHistory(
  db: Prisma.TransactionClient,
  scope: Scope,
  period: MarketPeriod,
  purity: number,
  kind: GoldPriceKind,
  goldEnabled: boolean,
  now = new Date(),
): Promise<MarketSeries> {
  const start = new Date(now.getTime() - duration[period]);
  const [rows, initial, changes, currentMarket] = await Promise.all([
    quotes(db, new Date(start.getTime() - maxQuoteAgeMs), now),
    currentGoldRules(db, scope, [kind], [purity], start),
    db.storeGoldPriceRule.findMany({
      where: {
        organizationId: scope.organizationId,
        storeId: scope.storeId,
        kind,
        OR: [{ purity }, { purity: null }],
        effectiveAt: { gte: start, lte: now },
      },
      orderBy: [{ effectiveAt: "asc" }, { id: "asc" }],
    }),
    readGoldMarket(db, goldEnabled, now),
  ]);
  type Quote = (typeof rows)[number];
  type Rule = (typeof initial)[number];
  type Event = { at: Date; quote?: Quote; rule?: Rule; expires?: string };
  const events: Event[] = [
    // Historical effective prices can use an observation only once it was retrieved.
    ...rows.flatMap((quote) =>
      quote.firstRetrievedAt ? [{ at: quote.firstRetrievedAt, quote }] : [],
    ),
    ...rows
      .filter((quote) => quote.firstRetrievedAt)
      .map((quote) => ({
        at: new Date(quote.effectiveAt.getTime() + maxQuoteAgeMs),
        expires: quote.id,
      })),
    { at: start },
    ...changes.map((rule) => ({ at: rule.effectiveAt, rule })),
    { at: now },
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const rules = new Map(initial.map((rule) => [rule.purity, rule]));
  let quote: Market["quote"] = null;
  const observations = new Map<number, Observation>();
  for (const event of events) {
    const time = event.at.getTime();
    if (time > now.getTime()) break;
    if (event.expires && event.expires !== quote?.id) continue;
    if (event.quote) {
      const published = event.quote;
      if (
        !quote ||
        published.effectiveAt.getTime() >= Date.parse(quote.effectiveAt)
      ) {
        quote = {
          ...presentQuote(published),
          retrievedAt: event.at.toISOString(),
        };
      }
    }
    if (event.rule) rules.set(event.rule.purity, event.rule);
    if (time < start.getTime()) continue;
    const stale =
      !quote || time - Date.parse(quote.effectiveAt) >= maxQuoteAgeMs;
    const market = time === now.getTime() ? currentMarket : { quote, stale };
    const { rate } = resolveGoldRate([...rules.values()], kind, purity, market);
    observations.set(time, {
      at: event.at,
      value: rate,
      ruleChange: !!event.rule || observations.get(time)?.ruleChange,
    });
  }
  return summarizeMarketSeries([...observations.values()], period);
}

export async function dashboardExchangeHistory(
  db: Prisma.TransactionClient,
): Promise<OfficialRateHistory> {
  const rows = await db.officialExchangeRateObservation.findMany({
    where: { source: "CBAR" },
    orderBy: { effectiveDate: "desc" },
    take: 30,
  });
  const [latest, previous] = rows;
  const series = (key: "usd" | "eur" | "try") => ({
    points: rows
      .slice()
      .reverse()
      .map((row) => ({
        at: row.effectiveDate.toISOString().slice(0, 10),
        value: row[key].toFixed(),
      })),
    movement:
      latest && previous ? marketMovement(previous[key], latest[key]) : null,
  });
  const [usd, eur, tryCode] = officialRateCurrencies;
  return {
    effectiveDate: latest?.effectiveDate.toISOString().slice(0, 10) ?? null,
    currencies: {
      [usd]: series("usd"),
      [eur]: series("eur"),
      [tryCode]: series("try"),
    },
  };
}
