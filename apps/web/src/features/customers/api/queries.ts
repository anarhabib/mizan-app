import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  CustomerHistory,
  CustomerList,
  CustomerDetail,
  StoreContext,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import type { CursorPage } from "@/shared/hooks/useCursorPagination";

export type CustomerScope = Pick<StoreContext, "organizationId" | "storeId">;
const root = ({ organizationId, storeId }: CustomerScope) =>
  ["customers", organizationId, storeId] as const;
const lists = (scope: CustomerScope) => [...root(scope), "list"] as const;

export function customerPath(
  { organizationId, storeId }: CustomerScope,
  id?: string,
) {
  const path = `/organizations/${organizationId}/stores/${storeId}/customers`;
  return id ? `${path}/${encodeURIComponent(id)}` : path;
}

function pagePath(
  path: string,
  after?: string,
  q?: string,
  outstanding?: boolean,
  limit?: number,
) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (after) params.set("after", after);
  if (q) params.set("q", q);
  if (outstanding) params.set("outstanding", "true");
  return params.size ? `${path}?${params}` : path;
}

export function customerListQuery(
  scope: CustomerScope,
  search: string,
  outstanding = false,
) {
  return infiniteQueryOptions<
    CustomerList,
    ApiError,
    InfiniteData<CustomerList>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: outstanding
      ? [...lists(scope), search, "outstanding"]
      : [...lists(scope), search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      apiRequest<CustomerList>(
        pagePath(customerPath(scope), pageParam, search, outstanding),
        { signal },
      ),
    getNextPageParam: (page) => page.nextCursor,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function customerPageQuery(
  scope: CustomerScope,
  search: string,
  outstanding: boolean | undefined,
  page: CursorPage,
) {
  return queryOptions<CustomerList, ApiError>({
    queryKey: [...lists(scope), search, Boolean(outstanding), page] as const,
    queryFn: ({ signal }) =>
      apiRequest<CustomerList>(
        pagePath(
          customerPath(scope),
          page.after,
          search,
          outstanding,
          page.limit,
        ),
        { signal },
      ),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

const detailKey = (scope: CustomerScope, id: string) =>
  [...root(scope), "detail", id] as const;
const historyKey = (scope: CustomerScope, id: string) =>
  [...root(scope), "purchases", id] as const;

export function customerDetailQuery(scope: CustomerScope, id: string) {
  return queryOptions<CustomerDetail, ApiError>({
    queryKey: detailKey(scope, id),
    queryFn: ({ signal }) =>
      apiRequest<CustomerDetail>(customerPath(scope, id), { signal }),
    staleTime: 15_000,
  });
}

export function customerHistoryQuery(
  scope: CustomerScope,
  id: string,
  page: CursorPage,
) {
  return queryOptions<CustomerHistory, ApiError>({
    queryKey: [...historyKey(scope, id), page] as const,
    queryFn: ({ signal }) =>
      apiRequest<CustomerHistory>(
        pagePath(
          customerPath(scope, id) + "/purchases",
          page.after,
          undefined,
          undefined,
          page.limit,
        ),
        { signal },
      ),
    staleTime: 15_000,
  });
}

export async function invalidateCustomers(
  client: QueryClient,
  scope: CustomerScope,
  id?: string,
) {
  const listKeys = client.getQueryCache().findAll({ queryKey: lists(scope) });
  await Promise.all([
    ...listKeys.map(({ queryKey }) =>
      client.invalidateQueries({ queryKey, exact: true }),
    ),
    ...(id
      ? [
          detailKey(scope, id),
          ...client
            .getQueryCache()
            .findAll({ queryKey: historyKey(scope, id) })
            .map(({ queryKey }) => queryKey),
        ].map((queryKey) => client.invalidateQueries({ queryKey, exact: true }))
      : []),
  ]);
}
