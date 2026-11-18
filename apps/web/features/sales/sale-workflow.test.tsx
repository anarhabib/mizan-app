import { describe, expect, it } from "vitest";
import { previewSale } from "./settlement";

describe("sale settlement", () => {
  it("uses the active settlement currency precision without floating point conversion", () => {
    expect(
      previewSale("JPY", "9007199254740993", [{ weight: "0.025", rate: "20" }]),
    ).toMatchObject({ balance: "9007199254740993" });
    expect(
      previewSale("JPY", "1", [{ weight: "0.075", rate: "20" }]),
    ).toMatchObject({ balance: "-1" });
    expect(() => previewSale("JPY", "10.5", [])).toThrow();
  });
  it("rounds foreign cash and calculates default-currency change", () => {
    expect(
      previewSale("AZN", "10", [], {
        currency: "USD",
        amount: "6",
        exchangeRate: "1.705",
      }),
    ).toMatchObject({ balance: "10.00", converted: "10.23", change: "0.23" });
  });

  it("requires a rate for foreign cash and rejects insufficient tender", () => {
    expect(() =>
      previewSale("AZN", "10", [], { currency: "USD", amount: "6" }),
    ).toThrow();
    expect(() =>
      previewSale("AZN", "10", [], { currency: "AZN", amount: "9" }),
    ).toThrow();
  });

  it("uses exact trade-in calculations and overrides before rounding the balance", () => {
    expect(
      previewSale("AZN", "20", [
        { weight: "0.125", rate: "10.1234" },
        { weight: "2", rate: "5", overrideAmount: "20" },
      ]),
    ).toMatchObject({
      calculated: ["1.2654250", "10.0000000"],
      balance: "-1.27",
    });
    expect(
      previewSale("AZN", "10", [{ weight: "2", rate: "5" }]),
    ).toMatchObject({ balance: "0.00" });
  });
});
