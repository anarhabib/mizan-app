import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  type InfiniteData,
} from "@tanstack/react-query";
import type { SaleList, SaleResult, StoreContext } from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";

export type SaleScope = Pick<StoreContext, "organizationId" | "storeId">;
export type SaleFilters = { q?: string; date?: string };

// GET /sales/options in docs/API_NOTES.md has no shared response contract.
export type SaleOptions = {
  currency: string;
  rates: { id: string; purity: number; amountPerGram: string }[];
};

const scopeKey = ({ organizationId, storeId }: SaleScope) =>
  ["sales", organizationId, storeId] as const;

export const saleKeys = {
  lists: (scope: SaleScope) => [...scopeKey(scope), "list"] as const,
  list: (scope: SaleScope, filters: SaleFilters) =>
    [...saleKeys.lists(scope), filters] as const,
  detail: (scope: SaleScope, id: string) =>
    [...scopeKey(scope), "detail", id] as const,
  options: (scope: SaleScope) => [...scopeKey(scope), "options"] as const,
  create: (scope: SaleScope) => [...scopeKey(scope), "create"] as const,
};

export function salePath(
  { organizationId, storeId }: SaleScope,
  suffix = "",
  params: Record<string, string | undefined> = {},
) {
  const query = new URLSearchParams({ organizationId, storeId });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value);
  }
  return `/sales${suffix}?${query}`;
}

export function saleListQuery(scope: SaleScope, filters: SaleFilters) {
  return infiniteQueryOptions<
    SaleList,
    ApiError,
    InfiniteData<SaleList>,
    ReturnType<typeof saleKeys.list>,
    string | undefined
  >({
    queryKey: saleKeys.list(scope, filters),
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      apiRequest<SaleList>(
        salePath(scope, "", { ...filters, after: pageParam }),
        { signal },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function saleDetailQuery(scope: SaleScope, id: string) {
  return queryOptions<SaleResult, ApiError>({
    queryKey: saleKeys.detail(scope, id),
    queryFn: ({ signal }) =>
      apiRequest<SaleResult>(salePath(scope, `/${encodeURIComponent(id)}`), {
        signal,
      }),
    staleTime: 60_000,
  });
}

export function saleOptionsQuery(scope: SaleScope) {
  return queryOptions<SaleOptions, ApiError>({
    queryKey: saleKeys.options(scope),
    queryFn: ({ signal }) =>
      apiRequest<SaleOptions>(salePath(scope, "/options"), { signal }),
    staleTime: 5 * 60_000,
  });
}
