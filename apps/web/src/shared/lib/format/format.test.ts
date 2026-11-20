import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatMoney,
  formatWeight,
  formatPurity,
} from "./index";

describe("date and time", () => {
  it.each(["en", "az"])("uses the 24-hour clock in %s", (locale) => {
    const evening = new Date(2026, 10, 20, 18, 31).toISOString();
    const midnight = new Date(2026, 10, 20, 0, 5).toISOString();
    expect(formatDateTime(evening, locale)).toContain("18:31");
    expect(formatDateTime(midnight, locale)).toContain("00:05");
  });
});
describe("exact money formatting", () => {
  it.each([
    ["0", "AZN", "0,00 AZN"],
    ["-1234.50", "USD", "-1.234,50 USD"],
    ["12345678901234567890.1234", "AZN", "12.345.678.901.234.567.890,1234 AZN"],
    ["1.23", "AZN", "1,23 AZN"],
    ["1.234", "AZN", "1,234 AZN"],
    ["1.2300", "AZN", "1,2300 AZN"],
    ["1", "JPY", "1 JPY"],
    ["1.2", "KWD", "1,200 KWD"],
  ])("%s %s preserves precision", (amount, currency, expected) =>
    expect(formatMoney({ amount, currency })).toBe(expected),
  );
  it("uses English separators", () =>
    expect(formatMoney({ amount: "1234.5", currency: "EUR" }, "en")).toBe(
      "1,234.50 EUR",
    ));
  it.each(["", "01", "NaN", "1e3", "1.", "+1", " 1", "1,2", "--1"])(
    "rejects %s",
    (amount) =>
      expect(() => formatMoney({ amount, currency: "AZN" })).toThrow(),
  );
  it("rejects invalid currency", () =>
    expect(() => formatMoney({ amount: "1", currency: "BAD" })).toThrow());
});
describe("weight and purity", () => {
  it.each([
    ["0", "0 g"],
    ["-1234.500", "-1.234,500 g"],
    ["999999999999.123", "999.999.999.999,123 g"],
    ["1.20", "1,20 g"],
  ])("formats %s", (value, expected) =>
    expect(formatWeight(value)).toBe(expected),
  );
  it.each(["1.2345", "abc", ""])("rejects invalid weight %s", (value) =>
    expect(() => formatWeight(value)).toThrow(),
  );
  it("formats fineness", () => expect(formatPurity(585)).toBe("585"));
  it.each([0, 1000, 58.5, NaN])("rejects invalid fineness %s", (value) =>
    expect(() => formatPurity(value)).toThrow(),
  );
});
