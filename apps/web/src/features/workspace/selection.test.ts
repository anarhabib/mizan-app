import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreContext } from "@mizan/contracts";
import {
  parseSelection,
  readSelection,
  resolveSelection,
  saveSelection,
} from "./selection";
import { storeQueryKey } from "./api";

const first: StoreContext = {
  organizationId: "org-a",
  organizationName: "A",
  storeId: "store",
  storeName: "First",
  role: "OWNER",
};
const second: StoreContext = {
  ...first,
  organizationId: "org-b",
  storeName: "Second",
  role: "SALESPERSON",
};

afterEach(() => vi.unstubAllGlobals());

describe("workspace selection", () => {
  it("selects automatically and falls back when the previous assignment is gone", () => {
    expect(resolveSelection([], first)).toBeUndefined();
    expect(resolveSelection([first], null)).toBe(first);
    expect(resolveSelection([first], second)).toBe(first);
  });

  it("matches both scope IDs and includes both in query keys", () => {
    expect(resolveSelection([first, second], second)).toBe(second);
    expect(storeQueryKey(first)).toEqual([
      "store",
      first.organizationId,
      first.storeId,
    ]);
    expect(storeQueryKey(first)).not.toEqual(storeQueryKey(second));
  });

  it.each([
    null,
    "junk",
    "null",
    "[]",
    '{"organizationId":"a","storeId":4}',
    '{"storeId":"b"}',
  ])("ignores invalid stored selection %s", (value) =>
    expect(parseSelection(value)).toBeNull(),
  );

  it("stores only the scope under the current user", () => {
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: entries.get.bind(entries),
      setItem: entries.set.bind(entries),
    });
    saveSelection("alice", second);
    expect(readSelection("alice")).toEqual({
      organizationId: "org-b",
      storeId: "store",
    });
    expect(readSelection("bob")).toBeNull();
  });

  it("still works when browser storage is blocked", () => {
    const denied = () => {
      throw new Error("Storage denied");
    };
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied });
    expect(readSelection("alice")).toBeNull();
    expect(() => saveSelection("alice", first)).not.toThrow();
  });
});
