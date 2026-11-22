import { describe, expect, it, vi } from "vitest";
import {
  goldReferencePerGram,
  normalizeGoldQuote,
  retrieveGoldQuote,
} from "../src/modules/gold-prices/gold-api.js";

const now = new Date("2026-11-22T12:00:00Z");
const sample = { symbol: "XAU", currency: "USD", updatedAt: now.toISOString() };

describe("Gold API quotes", () => {
  it("converts troy ounces and applies USD/AZN before rounding", () => {
    expect(normalizeGoldQuote("31.1034768", "1")).toBe("1.00000000");
    expect(normalizeGoldQuote("3110.34768", "1.7")).toBe("170.00000000");
    expect(normalizeGoldQuote("2500", "1.7")).toBe("136.64067292");
  });

  it.each([
    [585, "99.45"],
    [750, "127.50"],
    [999, "169.83"],
  ])("calculates the %i fineness reference", (purity, expected) => {
    expect(goldReferencePerGram("170.00000000", purity)).toBe(expected);
  });

  it("retains exact upstream digits when JSON represents the price as a number", async () => {
    const body = JSON.stringify(sample).replace(
      /}$/,
      ',"price":12345.123456789123}',
    );
    await expect(
      retrieveGoldQuote(now, vi.fn().mockResolvedValue(new Response(body))),
    ).resolves.toEqual({
      effectiveAt: now,
      usdPerTroyOunce: "12345.123456789123",
    });
  });

  it.each([
    { price: 0 },
    { price: -10 },
    { price: "1e6" },
    { currency: "EUR", price: 50 },
    { symbol: "XAG", price: 50 },
    { updatedAt: "2026-11-22T12:02:00Z", price: 50 },
    { updatedAt: "2026-02-30T12:00:00Z", price: 50 },
  ])("rejects invalid provider data %o", async (raw) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ...sample, ...raw }));
    await expect(retrieveGoldQuote(now, fetcher)).rejects.toThrow();
  });

  it("treats a provider error as a failed fetch", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(retrieveGoldQuote(now, fetcher)).rejects.toThrow("HTTP 503");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
