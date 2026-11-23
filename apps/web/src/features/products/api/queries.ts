import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  ProductDetail,
  ProductGemstoneFilter,
  ProductList,
  ProductOverview,
  ProductStatus,
  StoreContext,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import type { CursorPage } from "@/shared/hooks/useCursorPagination";

export type ProductScope = Pick<StoreContext, "organizationId" | "storeId">;

export type ProductFilters = {
  q?: string;
  status?: ProductStatus;
  category?: string;
  categoryId?: string;
  purity?: number;
  gemstones?: ProductGemstoneFilter;
  soldOn?: string;
  receivedOn?: string;
  agedDays?: number;
  credit?: true;
};

// GET /products/options in docs/API_NOTES.md.
type ProductOptions = { defaultCurrency: string; purities: number[] };

const scopeKey = ({ organizationId, storeId }: ProductScope) =>
  ["products", organizationId, storeId] as const;

export const productKeys = {
  lists: (scope: ProductScope) => [...scopeKey(scope), "list"] as const,
  list: (scope: ProductScope, filters: ProductFilters) =>
    [...productKeys.lists(scope), filters] as const,
  facets: (scope: ProductScope) => [...scopeKey(scope), "facets"] as const,
  overview: (scope: ProductScope, owner: boolean) =>
    [...scopeKey(scope), "overview", owner] as const,
  details: (scope: ProductScope) => [...scopeKey(scope), "detail"] as const,
  detail: (scope: ProductScope, id: string) =>
    [...productKeys.details(scope), id] as const,
  options: (scope: ProductScope) => [...scopeKey(scope), "options"] as const,
  create: (scope: ProductScope) => [...scopeKey(scope), "create"] as const,
  edit: (scope: ProductScope, id: string) =>
    [...scopeKey(scope), "edit", id] as const,
  delete: (scope: ProductScope, id: string) =>
    [...scopeKey(scope), "delete", id] as const,
  photo: (scope: ProductScope, id: string) =>
    [...scopeKey(scope), "photo", id] as const,
};

export function productPath(
  { organizationId, storeId }: ProductScope,
  suffix = "",
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const query = new URLSearchParams({ organizationId, storeId });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return `/products${suffix}?${query}`;
}

export function productPageQuery(
  scope: ProductScope,
  filters: ProductFilters,
  page: CursorPage,
) {
  return queryOptions<ProductList, ApiError>({
    queryKey: [...productKeys.list(scope, filters), page] as const,
    queryFn: ({ signal }) =>
      apiRequest<ProductList>(
        productPath(scope, "", { ...filters, ...page, photos: 1 }),
        { signal },
      ),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function productOverviewQuery(scope: ProductScope, owner: boolean) {
  return queryOptions<ProductOverview, ApiError>({
    queryKey: productKeys.overview(scope, owner),
    queryFn: ({ signal }) =>
      apiRequest<ProductOverview>(productPath(scope, "/overview"), { signal }),
    staleTime: 15_000,
  });
}

export function productListQuery(scope: ProductScope, filters: ProductFilters) {
  return infiniteQueryOptions<
    ProductList,
    ApiError,
    InfiniteData<ProductList>,
    ReturnType<typeof productKeys.list>,
    string | undefined
  >({
    queryKey: productKeys.list(scope, filters),
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      apiRequest<ProductList>(
        productPath(scope, "", { ...filters, after: pageParam }),
        { signal },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function productFacetsQuery(scope: ProductScope) {
  return queryOptions<
    ProductList,
    ApiError,
    ProductList["filters"],
    ReturnType<typeof productKeys.facets>
  >({
    queryKey: productKeys.facets(scope),
    queryFn: ({ signal }) =>
      apiRequest<ProductList>(
        productPath(scope, "", { facets: 1, limit: 10 }),
        {
          signal,
        },
      ),
    select: (data) => data.filters,
    staleTime: 60_000,
  });
}

export function productDetailQuery(scope: ProductScope, id: string) {
  return queryOptions<
    ProductDetail,
    ApiError,
    ProductDetail,
    ReturnType<typeof productKeys.detail>
  >({
    queryKey: productKeys.detail(scope, id),
    queryFn: ({ signal }) =>
      apiRequest<ProductDetail>(
        productPath(scope, `/${encodeURIComponent(id)}`),
        { signal },
      ),
    staleTime: 20_000,
  });
}

export function productOptionsQuery(scope: ProductScope) {
  return queryOptions<
    ProductOptions,
    ApiError,
    ProductOptions,
    ReturnType<typeof productKeys.options>
  >({
    queryKey: productKeys.options(scope),
    queryFn: ({ signal }) =>
      apiRequest<ProductOptions>(productPath(scope, "/options"), { signal }),
    staleTime: 5 * 60_000,
  });
}

export async function invalidateProductInventory(
  client: QueryClient,
  scope: ProductScope,
) {
  const listKeys = client
    .getQueryCache()
    .findAll({ queryKey: productKeys.lists(scope) })
    .map(({ queryKey }) => queryKey);
  await Promise.all(
    [
      ...listKeys,
      productKeys.facets(scope),
      productKeys.overview(scope, false),
      productKeys.overview(scope, true),
    ].map((queryKey) => client.invalidateQueries({ queryKey, exact: true })),
  );
}

export async function cacheSoldProduct(
  client: QueryClient,
  scope: ProductScope,
  id: string,
  sale: NonNullable<ProductDetail["sale"]>,
  hasOutstandingDebt?: boolean,
) {
  const lists = client
    .getQueryCache()
    .findAll({ queryKey: productKeys.lists(scope) });
  const detailKey = productKeys.detail(scope, id);
  // Discard reads that may have started before the sale committed.
  await Promise.all(
    [detailKey, ...lists.map(({ queryKey }) => queryKey)].map((queryKey) =>
      client.cancelQueries({ queryKey, exact: true }),
    ),
  );

  client.setQueryData<ProductDetail>(
    detailKey,
    (product) =>
      product && { ...product, status: "SOLD", sale, hasOutstandingDebt },
  );
  for (const { queryKey } of lists) {
    const filters = queryKey[4] as ProductFilters;
    const update = (page: ProductList): ProductList => ({
      ...page,
      items:
        filters.status === "IN_STOCK" || (filters.credit && !hasOutstandingDebt)
          ? page.items.filter((item) => item.id !== id)
          : page.items.map((item) =>
              item.id === id
                ? { ...item, status: "SOLD", hasOutstandingDebt }
                : item,
            ),
    });
    if (queryKey.length === 5) {
      client.setQueryData<InfiniteData<ProductList>>(
        queryKey,
        (data) => data && { ...data, pages: data.pages.map(update) },
      );
    } else {
      client.setQueryData<ProductList>(
        queryKey,
        (data) => data && update(data),
      );
    }
  }
}
