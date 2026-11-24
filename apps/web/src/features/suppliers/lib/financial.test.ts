import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/lib/api";
import { formatPayable, submitFinancialAttempt } from "./financial";

afterEach(() => vi.unstubAllGlobals());

describe("supplier payment retries", () => {
  it("reuses the same request key after an unknown outcome", async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });
    const payload = { amount: "24.5725", currency: "AZN", method: "CARD" };
    const network = new ApiError(
      0,
      "NETWORK_ERROR",
      "Connection lost",
      undefined,
      true,
    );
    const lost = vi.fn(async () => {
      throw network;
    });
    await expect(
      submitFinancialAttempt("owner/store/payment", payload, lost),
    ).rejects.toBe(network);
    const [[storageKey, requestKey]] = stored.entries();
    expect(storageKey).not.toContain(payload.amount);
    expect(storageKey).not.toContain(payload.method);
    const saved = vi.fn(async ({ key }: { key: string }) => ({
      id: "payment",
      key,
    }));
    await expect(
      submitFinancialAttempt("owner/store/payment", payload, saved),
    ).resolves.toEqual({ id: "payment", key: requestKey });
    expect(saved).toHaveBeenCalledWith({ body: payload, key: requestKey });
    expect(stored.size).toBe(0);
    await submitFinancialAttempt("owner/store/payment", payload, saved);
    expect(saved.mock.lastCall?.[0]).not.toEqual({
      body: payload,
      key: requestKey,
    });
  });

  it("scopes uncertain attempts to the exact payload and operation", async () => {
    const keys: string[] = [];
    const send = async ({ key }: { key: string }) => {
      keys.push(key);
      throw new ApiError(0, "NETWORK_ERROR", "Offline", undefined, true);
    };
    for (const [partition, amount] of [
      ["store-a", "5"],
      ["store-a", "4"],
      ["store-b", "5"],
      ["store-a", "5"],
    ]) {
      await expect(
        submitFinancialAttempt(partition, { amount }, send),
      ).rejects.toThrow("Offline");
    }
    expect(new Set(keys).size).toBe(3);
    expect(keys[3]).toBe(keys[0]);
  });
});

describe("payable display", () => {
  it("keeps actual precision and formatting by currency", () => {
    expect(formatPayable({ amount: "1234.0051", currency: "AZN" }, "az")).toBe(
      "1.234,0051 AZN",
    );
    expect(formatPayable({ amount: "12", currency: "USD" }, "en")).toBe(
      "12.00 USD",
    );
    expect(formatPayable({ amount: "0.1", currency: "KWD" }, "en")).toBe(
      "0.100 KWD",
    );
  });
});
