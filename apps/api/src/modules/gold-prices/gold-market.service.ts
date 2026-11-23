import {
  roundMoneyHalfUp,
  type GoldPriceHistory,
  type GoldMarketPrice,
  type ExchangeRatesResponse,
  type GoldMarketPrices,
} from "@mizan/contracts";
import type { Prisma } from "@mizan/database";
import type { OrganizationDatabase } from "../access/organization-owner.js";
import { AccessError } from "../access/access.errors.js";
import { uuidPattern } from "../access/access.service.js";
import {
  goldMarketSource as source,
  goldReferencePerGram,
  normalizeGoldQuote,
  retrieveGoldQuote,
} from "./gold-api.js";

const where = { source };
const include = { quote: true } as const;
export const goldRefreshMs = 15 * 60 * 1000;
export const maxQuoteAgeMs = 24 * 60 * 60 * 1000;
const bakuDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Baku" });
type MarketState = Pick<GoldMarketPrices, "quote" | "stale">;

export function presentQuote(
  quote: Prisma.GoldMarketQuoteGetPayload<object>,
): Omit<GoldMarketPrice, "retrievedAt"> {
  const normalizedAznPerGram = quote.aznPerGram.toFixed();
  return {
    id: quote.id,
    source,
    effectiveAt: quote.effectiveAt.toISOString(),
    usdPerTroyOunce: quote.usdPerTroyOunce.toFixed(),
    usdAzn: quote.usdAzn.toFixed(),
    exchangeDate: quote.exchangeDate.toISOString().slice(0, 10),
    normalizedAznPerGram,
    pricePerGram: {
      amount: roundMoneyHalfUp(normalizedAznPerGram, 2),
      currency: "AZN",
    },
  };
}

function bakuMidnight(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AccessError("INVALID_SETTINGS");
  const date = new Date(`${value}T00:00:00+04:00`);
  if (!Number.isFinite(date.getTime()) || bakuDate.format(date) !== value)
    throw new AccessError("INVALID_SETTINGS");
  return date;
}

export async function getGoldPriceHistory(
  db: Prisma.TransactionClient,
  query: { after?: string; from?: string; through?: string },
): Promise<GoldPriceHistory> {
  const { after, from, through } = query;
  const gte = from === undefined ? undefined : bakuMidnight(from);
  const end = through === undefined ? undefined : bakuMidnight(through);
  const lt = end && new Date(end.getTime() + 24 * 60 * 60 * 1000);
  if (gte && lt && gte >= lt) throw new AccessError("INVALID_SETTINGS");
  const filters = { source, effectiveAt: { gte, lt } };
  if (
    after &&
    (!uuidPattern.test(after) ||
      !(await db.goldMarketQuote.findFirst({
        where: { ...filters, id: after },
        select: { id: true },
      })))
  )
    throw new AccessError("INVALID_SETTINGS");
  const rows = await db.goldMarketQuote.findMany({
    where: filters,
    orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
    take: 51,
    ...(after && { cursor: { id: after }, skip: 1 }),
  });
  const items = rows.slice(0, 50).map((row) => ({
    ...presentQuote(row),
    firstRetrievedAt: row.firstRetrievedAt?.toISOString() ?? null,
  }));
  return { items, ...(rows.length === 51 && { nextCursor: items[49].id }) };
}

export async function readGoldMarket(
  db: Prisma.TransactionClient,
  enabled = process.env.MIZAN_GOLD_PRICE_PROVIDER !== "off",
  now = new Date(),
): Promise<MarketState> {
  const cache = await db.goldMarketCache.findUnique({ where, include });
  if (!cache?.quote || !cache.retrievedAt) return { quote: null, stale: true };
  const { quote, retrievedAt, attemptedAt } = cache;
  return {
    quote: {
      ...presentQuote(quote),
      retrievedAt: retrievedAt.toISOString(),
    },
    stale:
      !enabled ||
      attemptedAt > retrievedAt ||
      now.getTime() - retrievedAt.getTime() >= goldRefreshMs ||
      now.getTime() - quote.effectiveAt.getTime() >= maxQuoteAgeMs,
  };
}

export async function lockGoldMarket(db: Prisma.TransactionClient) {
  await db.$queryRaw`SELECT "source" FROM "mizan"."GoldMarketCache" WHERE "source" = ${source} FOR SHARE`;
}

export function createGoldMarketService(
  db: OrganizationDatabase,
  getExchangeRates: () => Promise<ExchangeRatesResponse>,
  enabled: boolean,
  onFailure: (error: unknown) => void,
  retrieve = retrieveGoldQuote,
  clock = () => new Date(),
) {
  let inFlight: Promise<MarketState> | undefined;
  async function refresh() {
    const now = clock();
    const read = () => readGoldMarket(db, enabled, clock());
    if (!enabled) return read();

    const cutoff = new Date(now.getTime() - goldRefreshMs);
    const previous = await db.goldMarketCache.findUnique({ where, include });
    if (previous && previous.attemptedAt > cutoff) return read();
    const { count } = previous
      ? await db.goldMarketCache.updateMany({
          where: { source, attemptedAt: { lte: cutoff } },
          data: { attemptedAt: now },
        })
      : await db.goldMarketCache.createMany({
          data: { source, attemptedAt: now },
          skipDuplicates: true,
        });
    if (!count) return read();

    let observation;
    let aznPerGram: string;
    try {
      const [quote, exchange] = await Promise.all([
        retrieve(now),
        getExchangeRates(),
      ]);
      if (previous?.quote && quote.effectiveAt < previous.quote.effectiveAt)
        throw new Error("Gold API returned an older quote");
      const { snapshot } = exchange;
      if (
        exchange.stale ||
        !snapshot ||
        snapshot.effectiveDate > bakuDate.format(quote.effectiveAt)
      )
        throw new Error("An applicable USD/AZN rate is unavailable");
      observation = {
        ...quote,
        source,
        usdAzn: snapshot.rates.USD,
        exchangeDate: new Date(snapshot.effectiveDate),
      };
      aznPerGram = normalizeGoldQuote(
        observation.usdPerTroyOunce,
        observation.usdAzn,
      );
    } catch (error) {
      onFailure(error);
      return read();
    }
    await db.$transaction(async (tx) => {
      // Match the claim and lock its row before publishing a quote.
      const claim = await tx.goldMarketCache.updateMany({
        where: { source, attemptedAt: now },
        data: { attemptedAt: now },
      });
      if (!claim.count) return;
      const quote = await tx.goldMarketQuote.upsert({
        where: {
          source_effectiveAt_usdPerTroyOunce_usdAzn_exchangeDate: observation,
        },
        create: { ...observation, aznPerGram, firstRetrievedAt: clock() },
        update: {},
        select: { id: true },
      });
      await tx.goldMarketCache.update({
        where,
        data: { quoteId: quote.id, retrievedAt: clock() },
      });
    });
    return read();
  }

  return () => {
    inFlight ??= refresh().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}

export function goldReferences(
  market: MarketState,
  purities: number[],
): GoldMarketPrices {
  return {
    ...market,
    references: purities.map((purity) => ({
      purity,
      pricePerGram: market.quote && {
        amount: goldReferencePerGram(market.quote.normalizedAznPerGram, purity),
        currency: "AZN",
      },
    })),
  };
}
