import { expect, test } from "vitest";
import { suggestedItemAmount } from "./item-pricing";

test("multiplies decimal rates by net weight and rounds in the sale currency", () => {
  expect(suggestedItemAmount("12.345", "0.500", "AZN")).toBe("6.17");
  expect(suggestedItemAmount("12.345", "0.500", "KWD")).toBe("6.173");
  expect(suggestedItemAmount("12.345", "0.500", "JPY")).toBe("6");
  expect(suggestedItemAmount("0", "0.500", "AZN")).toBe("0.00");
});

test("rejects unusable weights, invalid rates and oversized totals", () => {
  expect(suggestedItemAmount("12", "0", "AZN")).toBeUndefined();
  expect(suggestedItemAmount("12", "1.0001", "AZN")).toBeUndefined();
  expect(suggestedItemAmount("-1", "2", "AZN")).toBeUndefined();
  expect(
    suggestedItemAmount("0.00000000000000001", "2", "AZN"),
  ).toBeUndefined();
  expect(suggestedItemAmount("9999999999999999", "2", "AZN")).toBeUndefined();
});
