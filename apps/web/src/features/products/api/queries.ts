import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  ProductDetail,
  ProductList,
  ProductStatus,
  StoreContext,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";

export type ProductScope = Pick<StoreContext, "organizationId" | "storeId">;

export type ProductFilters = {
  q?: string;
  status?: ProductStatus;
  category?: string;
  purity?: number;
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
  detail: (scope: ProductScope, id: string) =>
    [...scopeKey(scope), "detail", id] as const,
  options: (scope: ProductScope) => [...scopeKey(scope), "options"] as const,
  create: (scope: ProductScope) => [...scopeKey(scope), "create"] as const,
  photo: (scope: ProductScope, id: string) =>
    [...scopeKey(scope), "photo", id] as const,
};

export function productPath(
  { organizationId, storeId }: ProductScope,
  suffix = "",
  params: Record<string, string | number | undefined> = {},
) {
  const query = new URLSearchParams({ organizationId, storeId });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return `/products${suffix}?${query}`;
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
      apiRequest<ProductList>(productPath(scope, "", { facets: 1 }), {
        signal,
      }),
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
    [...listKeys, productKeys.facets(scope)].map((queryKey) =>
      client.invalidateQueries({ queryKey, exact: true }),
    ),
  );
}
