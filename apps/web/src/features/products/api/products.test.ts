import {
  InfiniteQueryObserver,
  QueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type {
  ProductDetail,
  ProductList,
  ProductListItem,
} from "@mizan/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { putSignedPhoto } from "./mutations";
import {
  cacheSoldProduct,
  invalidateProductInventory,
  productKeys,
  productListQuery,
  productOverviewQuery,
  productPageQuery,
} from "./queries";

const scope = { organizationId: "org", storeId: "store" };
afterEach(() => vi.unstubAllGlobals());

describe("product requests", () => {
  it("requests only the selected page and keeps cursor, credit, and scope in the cache key", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json({ items: [] })));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    const filters = {
      credit: true,
      status: "SOLD",
      category: "Rings",
    } as const;
    const first = productPageQuery(scope, filters, { limit: 10 });
    const next = productPageQuery(scope, filters, {
      limit: 10,
      after: "opaque+/=",
    });
    const larger = productPageQuery(scope, filters, { limit: 25 });
    await client.fetchQuery(first);
    await client.fetchQuery(next);
    await client.fetchQuery(larger);
    const requests = fetch.mock.calls.map(
      ([path]) => new URL(String(path), "https://mizan.test").searchParams,
    );
    expect(requests.map((params) => params.get("limit"))).toEqual([
      "10",
      "10",
      "25",
    ]);
    expect(requests.map((params) => params.get("after"))).toEqual([
      null,
      "opaque+/=",
      null,
    ]);
    expect(
      requests.every(
        (params) =>
          params.get("credit") === "true" && params.get("category") === "Rings",
      ),
    ).toBe(true);
    expect(
      productPageQuery({ ...scope, storeId: "another" }, filters, { limit: 10 })
        .queryKey,
    ).not.toEqual(first.queryKey);
  });

  it("separates overview data by workspace and display permissions", async () => {
    const fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          available: 217,
          sold: 82,
          soldOnCredit: 12,
          availableWeight: "503.125",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    const salesperson = productOverviewQuery(scope, false);
    const overview = await client.fetchQuery(salesperson);
    expect(overview.available).toBe(217);
    expect(overview).not.toHaveProperty("acquisitionValue");
    expect(productOverviewQuery(scope, true).queryKey).not.toEqual(
      salesperson.queryKey,
    );
    expect(
      productOverviewQuery({ ...scope, storeId: "another" }, false).queryKey,
    ).not.toEqual(salesperson.queryKey);
    const path = new URL(String(fetch.mock.calls[0][0]), "https://mizan.test");
    expect(path.pathname).toMatch(/\/products\/overview$/);
    expect(Object.fromEntries(path.searchParams)).toEqual(scope);
  });

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
      productKeys.overview(scope, true),
      productKeys.overview(scope, false),
      productKeys.overview({ ...scope, storeId: "another" }, true),
    ];
    for (const key of keys) client.setQueryData(key, {});
    await invalidateProductInventory(client, scope);
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual(
      [true, true, true, false, false, true, true, false],
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

  it("shows a confirmed sale in cached inventory before the server lists refetch", async () => {
    const client = new QueryClient();
    const product: ProductListItem = {
      id: "product",
      code: "001",
      name: "Ring",
      category: "Rings",
      purity: 585,
      weight: "4.500",
      status: "IN_STOCK",
    };
    const remaining = { ...product, id: "remaining" };
    const detail = {
      ...product,
      createdAt: "2026-11-20T14:31:00Z",
      movements: [],
      note: null,
      photo: null,
      sale: null,
    } satisfies ProductDetail;
    const sale = {
      id: "sale",
      createdAt: detail.createdAt,
      total: { amount: "750", currency: "AZN" },
    };
    const data: InfiniteData<ProductList> = {
      pages: [{ items: [product, remaining], nextCursor: "cursor" }],
      pageParams: [undefined],
    };
    const allKey = productKeys.list(scope, {});
    const stockKey = productKeys.list(scope, { status: "IN_STOCK" });
    const otherStore = productKeys.list({ ...scope, storeId: "another" }, {});
    const detailKey = productKeys.detail(scope, product.id);
    for (const key of [allKey, stockKey, otherStore])
      client.setQueryData(key, data);
    client.setQueryData(detailKey, detail);

    await cacheSoldProduct(client, scope, product.id, sale);

    const items = (key: typeof allKey) =>
      client.getQueryData<InfiniteData<ProductList>>(key)?.pages[0].items;
    expect(items(allKey)).toEqual([{ ...product, status: "SOLD" }, remaining]);
    expect(items(stockKey)).toEqual([remaining]);
    expect(items(otherStore)).toEqual([product, remaining]);
    expect(
      client.getQueryData<InfiniteData<ProductList>>(allKey)?.pages[0]
        .nextCursor,
    ).toBe("cursor");
    expect(client.getQueryData(detailKey)).toMatchObject({
      status: "SOLD",
      sale,
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
