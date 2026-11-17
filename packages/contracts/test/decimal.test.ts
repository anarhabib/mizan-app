import { describe, expect, test } from "vitest";
import { parseDecimal, roundMoneyHalfUp } from "../src/decimal.js";
import { currencyMinorUnits, parseMoney } from "../src/money.js";

describe("exact decimal input", () => {
  test.each([
    ["4.185", 3],
    ["92.1234", 4],
    ["1.70000001", 8],
    ["9007199254740993.123", 3],
  ])("preserves %s at scale %s", (input, scale) => {
    expect(parseDecimal(input, scale)).toBe(input);
  });

  test.each([
    ["4.1851", 3],
    ["92.12345", 4],
    ["1.700000001", 8],
    ["-0.001", 3],
    ["1e2", 3],
    ["4,185", 3],
  ])("rejects invalid wire value %s at scale %s", (input, scale) => {
    expect(() => parseDecimal(input, scale)).toThrow(RangeError);
  });
});

describe("final settlement rounding", () => {
  test.each([
    ["12.0049", 2, "12.00"],
    ["12.005", 2, "12.01"],
    ["-12.005", 2, "-12.01"],
    ["-0.004", 2, "0.00"],
    ["9999999999999999.995", 2, "10000000000000000.00"],
    ["2.5", 0, "3"],
    ["1.2345", 3, "1.235"],
  ])("rounds %s at scale %s to %s", (amount, scale, expected) => {
    expect(roundMoneyHalfUp(amount, scale)).toBe(expected);
  });
});

describe("currency minor units", () => {
  test.each([
    ["AZN", 2],
    ["JPY", 0],
    ["KWD", 3],
  ])("uses %s with %s minor units", (currency, scale) =>
    expect(currencyMinorUnits(currency)).toBe(scale),
  );
  test("rejects unrecognized currency or excess money precision", () => {
    expect(() => parseMoney({ currency: "ZZZ", amount: "1" })).toThrow(
      RangeError,
    );
    expect(() => parseMoney({ currency: "JPY", amount: "1.50" })).toThrow(
      RangeError,
    );
    expect(parseMoney({ currency: "KWD", amount: "1.001" })).toEqual({
      currency: "KWD",
      amount: "1.001",
    });
  });
});
