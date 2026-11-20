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
