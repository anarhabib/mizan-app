import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/lib/api";
import { resolvePurityForm, resolveRateForm, settingsErrorKey } from "./form";

describe("settings form parsing", () => {
  it.each(["1", " 585 ", "999"])("maps %s to integer fineness", (value) => {
    expect(resolvePurityForm({ value })).toEqual({
      values: { value: Number(value) },
      errors: {},
    });
  });

  it.each(["", "0", "1000", "585.0", "5e2", "-1"])(
    "rejects invalid fineness %j",
    (value) => {
      expect(resolvePurityForm({ value }).errors).toMatchObject({
        value: { type: "invalidPurity" },
      });
    },
  );

  const rate = {
    purity: "585",
    currency: " usd ",
    amountPerGram: "12345678901234,1234",
  };
  it("preserves the exact rate and normalizes the currency and decimal separator", () => {
    expect(resolveRateForm(rate)).toEqual({
      values: {
        purity: 585,
        currency: "USD",
        amountPerGram: "12345678901234.1234",
      },
      errors: {},
    });
  });

  it("maps invalid rate data to the corresponding form field", () => {
    expect(resolveRateForm({ ...rate, purity: "" }).errors).toMatchObject({
      purity: { type: "invalidPurity" },
    });
    expect(resolveRateForm({ ...rate, currency: "ZZZ" }).errors).toMatchObject({
      currency: { type: "invalidCurrency" },
    });
    for (const amountPerGram of [
      "0",
      "1.00001",
      "123456789012345",
      "1,000.25",
    ]) {
      expect(resolveRateForm({ ...rate, amountPerGram }).errors).toMatchObject({
        amountPerGram: { type: "invalidRate" },
      });
    }
  });
});

describe("settings error mapping", () => {
  it.each([
    [403, "HTTP_ERROR", "accessDenied"],
    [403, "ACCESS_DENIED", "accessDenied"],
    [409, "PURITY_CONFLICT", "purityConflict"],
    [400, "INVALID_SETTINGS", "invalidSettings"],
    [503, "AUTH_UNAVAILABLE", "authUnavailable"],
    [500, "INTERNAL_ERROR", "genericError"],
    [400, "UNRECOGNIZED", "genericError"],
  ])("maps %i %s to %s", (status, code, key) => {
    expect(
      settingsErrorKey(new ApiError(status, code, "internal message")),
    ).toBe(key);
  });

  it("maps network errors to a request-outcome warning", () => {
    expect(
      settingsErrorKey(
        new ApiError(0, "NETWORK_ERROR", "request failed", undefined, true),
      ),
    ).toBe("networkError");
  });
});
