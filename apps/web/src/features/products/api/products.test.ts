import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { putSignedPhoto } from "./mutations";
import {
  invalidateProductInventory,
  productKeys,
  productListQuery,
} from "./queries";

const scope = { organizationId: "org", storeId: "store" };
afterEach(() => vi.unstubAllGlobals());

describe("product requests", () => {
  it("sends scoped filters and preserves an opaque cursor across pages", async () => {
    const cursor = "opaque+/=?& é";
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ items: [], nextCursor: cursor }))
      .mockResolvedValueOnce(Response.json({ items: [] }));
    vi.stubGlobal("fetch", fetch);

    const client = new QueryClient();
    const observer = new InfiniteQueryObserver(
      client,
      productListQuery(scope, {
        q: "A + B",
        status: "SOLD",
        category: "Wedding & gifts",
        purity: 750,
      }),
    );
    await observer.refetch();
    await observer.fetchNextPage();

    const queries = fetch.mock.calls.map(
      ([path]) => new URL(String(path), "https://mizan.test").searchParams,
    );
    expect(Object.fromEntries(queries[0])).toEqual({
      ...scope,
      q: "A + B",
      status: "SOLD",
      category: "Wedding & gifts",
      purity: "750",
    });
    expect(queries[1].get("after")).toBe(cursor);
  });

  it("invalidates every cached list and the facets for only the affected store", async () => {
    const client = new QueryClient();
    const keys = [
      productKeys.list(scope, {}),
      productKeys.list(scope, { status: "IN_STOCK" }),
      productKeys.facets(scope),
      productKeys.detail(scope, "product"),
      productKeys.list({ ...scope, storeId: "another" }, {}),
    ];
    for (const key of keys) client.setQueryData(key, {});
    await invalidateProductInventory(client, scope);
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual(
      [true, true, true, false, false],
    );
  });

  it("puts JPEG bytes at the signed URL with no application credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const jpeg = new Blob(["jpeg"], { type: "image/jpeg" });
    const url = "https://storage.test/upload?token=signed";
    await putSignedPhoto(url, jpeg);
    expect(fetch).toHaveBeenCalledWith(url, {
      method: "PUT",
      body: jpeg,
      headers: { "Content-Type": "image/jpeg" },
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  });

  it("distinguishes storage rejection from a network failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockRejectedValueOnce(new TypeError("Network error"));
    vi.stubGlobal("fetch", fetch);
    const jpeg = new Blob([]);
    await expect(
      putSignedPhoto("https://storage.test/photo", jpeg),
    ).rejects.toMatchObject({ code: "PHOTO_UNAVAILABLE" });
    await expect(
      putSignedPhoto("https://storage.test/photo", jpeg),
    ).rejects.toMatchObject({ isNetwork: true });
  });
});
