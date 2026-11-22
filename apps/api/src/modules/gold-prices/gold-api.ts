import { parseDecimal } from "@mizan/contracts";
import { Prisma } from "@mizan/database";

export const goldMarketSource = "GOLD_API" as const;
const endpoint = "https://api.gold-api.com/price/XAU";
const Decimal = Prisma.Decimal.clone({ precision: 48 });
const gramsPerTroyOunce = "31.1034768";
const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

async function requestGoldQuote(fetcher: typeof fetch) {
  const send = () =>
    fetcher(endpoint, {
      signal: AbortSignal.timeout(3_000),
      redirect: "error",
    });
  const first = await send().catch(() => null);
  if (first && first.status < 500) return first;
  await first?.body?.cancel();
  return send();
}

export async function retrieveGoldQuote(now: Date, fetcher = fetch) {
  const response = await requestGoldQuote(fetcher);
  if (!response.ok)
    throw new Error(`Gold API returned HTTP ${response.status}`);
  const data: unknown = JSON.parse(
    await response.text(),
    (key: string, value: unknown, context?: { source?: string }) =>
      key === "price" && typeof value === "number" ? context?.source : value,
  );
  if (!data || typeof data !== "object") throw new Error("Invalid gold quote");
  const { symbol, currency, price, updatedAt } = data as Record<
    string,
    unknown
  >;
  if (
    symbol !== "XAU" ||
    currency !== "USD" ||
    typeof updatedAt !== "string" ||
    !utcTimestamp.test(updatedAt) ||
    typeof price !== "string" ||
    price.length > 27 ||
    price.split(".")[0].length > 14 ||
    !/[1-9]/.test(price)
  )
    throw new Error("Invalid gold quote");

  const effectiveAt = new Date(updatedAt);
  if (
    !Number.isFinite(effectiveAt.getTime()) ||
    effectiveAt.toISOString().slice(0, 19) !== updatedAt.slice(0, 19) ||
    effectiveAt.getTime() > now.getTime() + 60_000
  )
    throw new Error("Invalid gold quote timestamp");

  return { effectiveAt, usdPerTroyOunce: parseDecimal(price, 12) };
}

export function normalizeGoldQuote(usdPerTroyOunce: string, usdAzn: string) {
  const normalized = new Decimal(usdPerTroyOunce)
    .times(usdAzn)
    .div(gramsPerTroyOunce)
    .toFixed(8, Decimal.ROUND_HALF_UP);
  if (!/[1-9]/.test(normalized) || normalized.split(".")[0].length > 14)
    throw new Error("Gold price is outside supported precision");
  return normalized;
}

export function goldReferencePerGram(aznPerGram: string, purity: number) {
  return new Decimal(aznPerGram)
    .times(purity)
    .div(1000)
    .toFixed(2, Decimal.ROUND_HALF_UP);
}
