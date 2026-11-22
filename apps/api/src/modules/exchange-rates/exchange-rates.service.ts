import type { ExchangeRatesResponse } from "@mizan/contracts";
import type { createDatabase } from "@mizan/database";
import { retrieveCbarRates } from "./cbar.js";

export const refreshIntervalMs = 24 * 60 * 60 * 1000;
const source = "CBAR" as const;
const where = { source };
export type ExchangeRateCache = Pick<
  ReturnType<typeof createDatabase>["officialExchangeRateSnapshot"],
  "findUnique" | "createMany" | "updateMany"
>;
type Row = NonNullable<Awaited<ReturnType<ExchangeRateCache["findUnique"]>>>;

export function presentExchangeRates(
  row: Row | null,
  now: Date,
): ExchangeRatesResponse {
  if (
    !row?.effectiveDate ||
    !row.retrievedAt ||
    !row.usd ||
    !row.eur ||
    !row.try
  ) {
    return { snapshot: null, stale: true };
  }
  return {
    snapshot: {
      source,
      effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
      retrievedAt: row.retrievedAt.toISOString(),
      rates: {
        USD: row.usd.toFixed(),
        EUR: row.eur.toFixed(),
        TRY: row.try.toFixed(),
      },
    },
    stale:
      row.retrievedAt < row.attemptedAt ||
      now.getTime() - row.retrievedAt.getTime() >= refreshIntervalMs,
  };
}

export function createExchangeRateService(
  cache: ExchangeRateCache,
  onFailure: (error: unknown) => void,
  retrieve = retrieveCbarRates,
  clock = () => new Date(),
) {
  let inFlight: Promise<ExchangeRatesResponse> | undefined;

  async function readOrRefresh() {
    const now = clock();
    const previous = await cache.findUnique({ where });
    const cutoff = new Date(now.getTime() - refreshIntervalMs);
    if (previous && previous.attemptedAt > cutoff)
      return presentExchangeRates(previous, now);

    // Claim the refresh in the shared database, including across API restarts.
    const { count } = previous
      ? await cache.updateMany({
          where: { source, attemptedAt: { lte: cutoff } },
          data: { attemptedAt: now },
        })
      : await cache.createMany({
          data: { source, attemptedAt: now },
          skipDuplicates: true,
        });
    if (!count)
      return presentExchangeRates(await cache.findUnique({ where }), now);

    let bulletin;
    try {
      bulletin = await retrieve(now);
      if (
        previous?.effectiveDate &&
        bulletin.effectiveDate <
          previous.effectiveDate.toISOString().slice(0, 10)
      )
        throw new Error("CBAR returned an older bulletin");
    } catch (error) {
      onFailure(error);
      return presentExchangeRates(
        previous && { ...previous, attemptedAt: now },
        clock(),
      );
    }

    const data = {
      effectiveDate: new Date(bulletin.effectiveDate),
      retrievedAt: clock(),
      usd: bulletin.rates.USD,
      eur: bulletin.rates.EUR,
      try: bulletin.rates.TRY,
    };
    // Fence the write if this process lost its claim.
    await cache.updateMany({ where: { source, attemptedAt: now }, data });
    return presentExchangeRates(await cache.findUnique({ where }), clock());
  }

  return () => {
    inFlight ??= readOrRefresh().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}
