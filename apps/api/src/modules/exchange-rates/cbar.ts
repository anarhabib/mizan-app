import {
  officialRateCurrencies,
  type OfficialExchangeRates,
} from "@mizan/contracts";
import { Prisma } from "@mizan/database";

const ratesPage = "https://www.cbar.az/currency/rates?language=en";
const bulletinBase = "https://cbar.az/currencies/";
const maxBytes = 256 * 1024;
const bakuDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Baku",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isoDate(value: string) {
  const [day, month, year] = value.split(".");
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(date);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Error("Invalid CBAR bulletin date");
  return date;
}

export function parseCbarBulletin(xml: string, bulletinDate: string) {
  const root =
    /^(?:<\?xml[^?]*\?>\s*)?<ValCurs\b([^<>]*)>([\s\S]*)<\/ValCurs>$/u.exec(
      xml.trim(),
    );
  const date = root?.[1].match(/\bDate=["'](\d{2}\.\d{2}\.\d{4})["']/u)?.[1];
  if (!root || !date || date !== bulletinDate || /<!/u.test(xml))
    throw new Error("Invalid CBAR bulletin");

  const rates = {} as OfficialExchangeRates["rates"];
  for (const currency of officialRateCurrencies) {
    const entry = new RegExp(
      `<Valute\\s+Code=["']${currency}["']\\s*>([\\s\\S]*?)<\\/Valute>`,
      "gu",
    );
    const rows = [...root[2].matchAll(entry)];
    const values =
      /^\s*<Nominal>\s*([1-9]\d{0,7})\s*<\/Nominal>\s*<Name>[^<>]*<\/Name>\s*<Value>\s*((?:0|[1-9]\d{0,11})(?:\.\d{1,8})?)\s*<\/Value>\s*$/u.exec(
        rows[0]?.[1] ?? "",
      );
    if (rows.length !== 1 || !values)
      throw new Error(`Invalid CBAR ${currency} rate`);
    const rate = new Prisma.Decimal(values[2])
      .div(values[1])
      .toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_UP);
    if (!rate.gt(0)) throw new Error(`Invalid CBAR ${currency} rate`);
    rates[currency] = rate.toFixed();
  }
  return { effectiveDate: isoDate(date), rates };
}

async function fetchDocument(fetcher: typeof fetch, url: string, mime: RegExp) {
  // A transient failure can be retried once, with a fresh timeout.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(3_000),
        redirect: "error",
      });
      if (
        !response.ok ||
        !mime.test(response.headers.get("content-type") ?? "") ||
        !response.body
      ) {
        await response.body?.cancel();
        throw new Error("CBAR document unavailable");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let document = "";
      let bytes = 0;
      try {
        for (
          let chunk = await reader.read();
          !chunk.done;
          chunk = await reader.read()
        ) {
          bytes += chunk.value.byteLength;
          if (bytes > maxBytes) throw new Error("CBAR document too large");
          document += decoder.decode(chunk.value, { stream: true });
        }
        return document + decoder.decode();
      } finally {
        await reader.cancel();
      }
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
}

export async function retrieveCbarRates(now: Date, fetcher = fetch) {
  const page = await fetchDocument(fetcher, ratesPage, /^text\/html\b/i);
  // The public page links the bulletin currently in effect, including holidays.
  const date = page.match(
    /\bhref=["'](?:https:\/\/(?:www\.)?cbar\.az)?\/currencies\/(\d{2}\.\d{2}\.\d{4})\.xml["']/iu,
  )?.[1];
  if (!date || isoDate(date) > bakuDate.format(now))
    throw new Error("Missing or future CBAR bulletin");
  const xml = await fetchDocument(
    fetcher,
    `${bulletinBase}${date}.xml`,
    /^(application|text)\/xml\b/i,
  );
  return parseCbarBulletin(xml, date);
}
