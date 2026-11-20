import { describe, expect, it, vi } from "vitest";
import { saleAttempt } from "./attempt";

const payload = {
  productId: "product-1",
  expectedCurrency: "AZN",
  saleAmount: "200.00",
};

describe("sale idempotency", () => {
  it("reuses the original key and payload across retries", () => {
    const makeKey = vi.fn(() => "key-1");
    const initial = saleAttempt(undefined, payload, makeKey);
    const retry = saleAttempt(initial, { ...payload }, makeKey);
    expect(retry).toBe(initial);
    expect(retry.payload).toBe(payload);
    expect(makeKey).toHaveBeenCalledTimes(1);
  });

  it("starts a new attempt after a payload change, including a currency change", () => {
    const initial = saleAttempt(undefined, payload, () => "key-1");
    const updated = { ...payload, expectedCurrency: "USD" };
    expect(saleAttempt(initial, updated, () => "key-2")).toEqual({
      key: "key-2",
      payload: updated,
    });
  });

  it("creates a new key for the next sale after the successful attempt is cleared", () => {
    const makeKey = vi
      .fn()
      .mockReturnValueOnce("key-1")
      .mockReturnValueOnce("key-2");
    expect(saleAttempt(undefined, payload, makeKey).key).toBe("key-1");
    expect(saleAttempt(undefined, payload, makeKey).key).toBe("key-2");
  });
});
