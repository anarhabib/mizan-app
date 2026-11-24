import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  SaleList,
  SaleDateFilter,
  SalePaymentStatus,
  SaleOptions,
  SaleOverview,
  MoneyInput,
  SalePaymentInput,
  SalePreview,
  SalePreviewInput,
  SaleResult,
  StoreContext,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import type { CursorPage } from "@/shared/hooks/useCursorPagination";

export type SaleScope = Pick<StoreContext, "organizationId" | "storeId">;
export type SaleFilters = SaleDateFilter & {
  q?: string;
  paymentDate?: string;
  paymentStatus?: SalePaymentStatus;
};
export type SalePeriod = Pick<SaleDateFilter, "dateFrom" | "dateTo">;

const scopeKey = ({ organizationId, storeId }: SaleScope) =>
  ["sales", organizationId, storeId] as const;

export const saleKeys = {
  lists: (scope: SaleScope) => [...scopeKey(scope), "list"] as const,
  overview: (scope: SaleScope) => [...scopeKey(scope), "overview"] as const,
  list: (scope: SaleScope, filters: SaleFilters) =>
    [...saleKeys.lists(scope), filters] as const,
  detail: (scope: SaleScope, id: string) =>
    [...scopeKey(scope), "detail", id] as const,
  options: (scope: SaleScope) => [...scopeKey(scope), "options"] as const,
  preview: (scope: SaleScope, input?: string) =>
    [...scopeKey(scope), "preview", input] as const,
  paymentPreview: (scope: SaleScope, input?: string) =>
    [...scopeKey(scope), "payment-preview", input] as const,
  create: (scope: SaleScope) => [...scopeKey(scope), "create"] as const,
};

export function salePath(
  { organizationId, storeId }: SaleScope,
  suffix = "",
  params: Record<string, string | number | undefined> = {},
) {
  const query = new URLSearchParams({ organizationId, storeId });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return `/sales${suffix}?${query}`;
}

export function paymentPreviewQuery(scope: SaleScope, serialized?: string) {
  return queryOptions<MoneyInput, ApiError>({
    queryKey: saleKeys.paymentPreview(scope, serialized),
    queryFn: ({ signal }) =>
      apiRequest<MoneyInput>(salePath(scope, "/payment-preview"), {
        method: "POST",
        body: JSON.parse(serialized!) as SalePaymentInput,
        signal,
      }),
    enabled: serialized !== undefined,
    retry: false,
    staleTime: Infinity,
  });
}

export function saleListQuery(
  scope: SaleScope,
  filters: SaleFilters,
  page: CursorPage,
  enabled = true,
) {
  return queryOptions<SaleList, ApiError>({
    queryKey: [...saleKeys.list(scope, filters), page] as const,
    queryFn: ({ signal }) =>
      apiRequest<SaleList>(
        salePath(scope, "", { ...filters, ...page, photos: 1 }),
        {
          signal,
        },
      ),
    enabled,
    placeholderData: (previous, query) => {
      const previousFilters = query?.queryKey[4] as SaleFilters | undefined;
      if (
        previousFilters?.date === filters.date &&
        previousFilters?.dateFrom === filters.dateFrom &&
        previousFilters?.dateTo === filters.dateTo
      )
        return previous;
    },
    staleTime: 15_000,
  });
}

export function saleOverviewQuery(
  scope: SaleScope,
  period: SalePeriod,
  enabled = true,
) {
  return queryOptions<SaleOverview, ApiError>({
    queryKey: [...saleKeys.overview(scope), period],
    queryFn: ({ signal }) =>
      apiRequest<SaleOverview>(salePath(scope, "/overview", period), {
        signal,
      }),
    enabled,
    staleTime: 15_000,
  });
}

export function invalidateSaleOverviews(client: QueryClient, scope: SaleScope) {
  return Promise.all(
    client
      .getQueryCache()
      .findAll({ queryKey: saleKeys.overview(scope) })
      .map(({ queryKey }) =>
        client.invalidateQueries({ queryKey, exact: true }),
      ),
  );
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
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function salePreviewQuery(scope: SaleScope, input?: SalePreviewInput) {
  const serialized = input ? JSON.stringify(input) : undefined;
  return queryOptions<SalePreview, ApiError>({
    queryKey: saleKeys.preview(scope, serialized),
    queryFn: ({ signal }) =>
      apiRequest<SalePreview>(salePath(scope, "/preview"), {
        method: "POST",
        body: input,
        signal,
      }),
    enabled: input !== undefined,
    retry: false,
  });
}
