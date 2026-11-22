import { Prisma } from "@mizan/database";
import { describe, expect, it, vi } from "vitest";
import {
  parseCbarBulletin,
  retrieveCbarRates,
} from "../src/modules/exchange-rates/cbar.js";
import {
  createExchangeRateService,
  presentExchangeRates,
  refreshIntervalMs,
  type ExchangeRateCache,
} from "../src/modules/exchange-rates/exchange-rates.service.js";
import { parsePayment } from "../src/modules/sales/sale-input.js";
import { convertPayment } from "../src/modules/sales/settlement.js";

const date = "20.11.2026";
const now = new Date("2026-11-22T12:00:00Z");
const entry = (code: string, nominal: string, value: string) =>
  `<Valute Code="${code}"><Nominal>${nominal}</Nominal><Name>${code}</Name><Value>${value}</Value></Valute>`;
const usd = entry("USD", "1", "1.7");
const xml = `<?xml version="1.0" encoding="UTF-8"?><ValCurs Date="${date}" Name="AZN məzənnələri">
  <ValType Type="Bank metalları">${entry("XAU", "1 t.u.", "6005.573")}</ValType>
  <ValType Type="Xarici valyutalar">
    ${usd}${entry("EUR", "1", "1.8666")}${entry("TRY", "100", "3.36")}
  </ValType>
</ValCurs>`;
const expected = {
  effectiveDate: "2026-11-20",
  rates: { USD: "1.7", EUR: "1.8666", TRY: "0.0336" },
};
const row = {
  source: "CBAR",
  effectiveDate: new Date(expected.effectiveDate),
  retrievedAt: now,
  attemptedAt: now,
  usd: new Prisma.Decimal("1.7"),
  eur: new Prisma.Decimal("1.8666"),
  try: new Prisma.Decimal("0.0336"),
};

describe("Central Bank of Azerbaijan exchange rates", () => {
  it("normalizes official nominal units into AZN per one foreign unit", () => {
    expect(parseCbarBulletin(xml, date)).toEqual(expected);
  });

  it.each([
    xml.replace(usd, ""),
    xml.replace(usd, usd + usd),
    xml.replace(usd, entry("USD", "0", "1.7")),
    xml.replace(usd, entry("USD", "1", "0")),
    xml.replace(usd, entry("USD", "1", "NaN")),
    xml.replace(date, "21.11.2026"),
    xml.replace("</ValCurs>", ""),
    "<html>Maintenance</html>",
  ])("rejects incomplete or invalid bulletins", (invalid) => {
    expect(() => parseCbarBulletin(invalid, date)).toThrow();
  });

  it("follows the official latest link on a non-publication day and retries once", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValueOnce(
        new Response(`<a href="/currencies/${date}.xml">XML</a>`, {
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(xml, { headers: { "content-type": "application/xml" } }),
      );
    await expect(retrieveCbarRates(now, fetcher)).resolves.toEqual(expected);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenLastCalledWith(
      `https://cbar.az/currencies/${date}.xml`,
      {
        signal: expect.any(AbortSignal),
        redirect: "error",
      },
    );
  });

  it("stops retrying after the second transport failure", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network down"));
    await expect(retrieveCbarRates(now, fetcher)).rejects.toThrow(
      "network down",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("marks failed or overdue refreshes stale while keeping a verified weekend bulletin current", () => {
    expect(presentExchangeRates(row, now).stale).toBe(false);
    const later = new Date(now.getTime() + refreshIntervalMs);
    expect(presentExchangeRates(row, later).stale).toBe(true);
    expect(
      presentExchangeRates({ ...row, attemptedAt: later }, later),
    ).toMatchObject({
      stale: true,
      snapshot: expected,
    });
  });

  it("shares an in-flight refresh and retains the last valid snapshot on provider failure", async () => {
    const later = new Date(now.getTime() + refreshIntervalMs);
    const failure = new Error("network down");
    const retrieve = vi.fn().mockRejectedValue(failure);
    const onFailure = vi.fn();
    const cache = {
      findUnique: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn(),
    };
    const read = createExchangeRateService(
      cache as unknown as ExchangeRateCache,
      onFailure,
      retrieve,
      () => later,
    );
    const first = read();
    expect(read()).toBe(first);
    await expect(first).resolves.toMatchObject({
      stale: true,
      snapshot: expected,
    });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(failure);
    expect(cache.updateMany).toHaveBeenCalledTimes(1);
    expect(cache.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attemptedAt: later } }),
    );
  });

  it("returns unavailable on first failure and suppresses repeated provider calls", async () => {
    const retrieve = vi.fn().mockRejectedValue(new Error("network down"));
    const cache = {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          ...row,
          effectiveDate: null,
          retrievedAt: null,
          usd: null,
          eur: null,
          try: null,
        }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn(),
    };
    const read = createExchangeRateService(
      cache as unknown as ExchangeRateCache,
      vi.fn(),
      retrieve,
      () => now,
    );
    await expect(read()).resolves.toEqual({ stale: true, snapshot: null });
    await expect(read()).resolves.toEqual({ stale: true, snapshot: null });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(cache.updateMany).not.toHaveBeenCalled();
  });

  it("converts a payment using the submitted official rate or manual override", () => {
    const tender = { method: "CASH", currency: "TRY", amount: "12.50" };
    const convert = (exchangeRate: string) =>
      convertPayment(
        parsePayment({ ...tender, exchangeRate }),
        "AZN",
        "1",
        "payment",
      );
    expect(convert(expected.rates.TRY)).toMatchObject({
      amountAzn: "0.42",
      exchangeRate: "0.0336",
    });
    expect(convert("0.0356")).toMatchObject({
      amountAzn: "0.45",
      exchangeRate: "0.0356",
    });
  });
});
