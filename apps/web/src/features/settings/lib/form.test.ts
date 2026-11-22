import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/lib/api";
import { resolvePurityForm, settingsErrorKey } from "./form";

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
