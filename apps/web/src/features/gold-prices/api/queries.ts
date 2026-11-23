import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  DashboardGoldHistory,
  DashboardGoldRates,
  GoldPriceKind,
  GoldMarketPrices,
  GoldPriceRuleHistory,
  GoldPricingChange,
  GoldPricingDraft,
  GoldPricingPreview,
  GoldPricingSettings,
  StoreGoldPriceRule,
  StoreContext,
  MarketPeriod,
  MarketSeries,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import type { CursorPage } from "@/shared/hooks/useCursorPagination";

type Scope = Pick<StoreContext, "organizationId" | "storeId">;
const baseKey = ({ organizationId, storeId }: Scope) =>
  ["gold-prices", organizationId, storeId] as const;
const path = ({ organizationId, storeId }: Scope) =>
  `/organizations/${encodeURIComponent(organizationId)}/stores/${encodeURIComponent(storeId)}/gold-prices`;

export function goldMarketQuery(scope: Scope) {
  return queryOptions<GoldMarketPrices, ApiError>({
    queryKey: [...baseKey(scope), "market"],
    queryFn: ({ signal }) => apiRequest(path(scope), { signal }),
    staleTime: 60_000,
    refetchInterval: 15 * 60_000,
    retry: false,
  });
}

export function goldPricingQuery(scope: Scope) {
  return queryOptions<GoldPricingSettings, ApiError>({
    queryKey: [...baseKey(scope), "settings"],
    queryFn: ({ signal }) => apiRequest(`${path(scope)}/settings`, { signal }),
    staleTime: 60_000,
    retry: false,
  });
}

export function goldMarketChartQuery(
  scope: Scope,
  period: MarketPeriod,
  purity: number | undefined,
  quoteId?: string | null,
) {
  return queryOptions({
    queryKey: [...baseKey(scope), "chart", period, purity, quoteId] as const,
    queryFn: ({ signal }) =>
      apiRequest<DashboardGoldHistory>(
        `${path(scope)}/chart?period=${period}${purity === undefined ? "" : `&purity=${purity}`}`,
        { signal },
      ),
    staleTime: 60_000,
  });
}

export function goldCurrentRatesQuery(scope: Scope) {
  return queryOptions({
    queryKey: [...baseKey(scope), "rates"] as const,
    queryFn: ({ signal }) =>
      apiRequest<DashboardGoldRates>(`${path(scope)}/rates`, { signal }),
    staleTime: 60_000,
  });
}

export function goldStoreChartQuery(
  scope: Scope,
  period: MarketPeriod,
  purity: number | undefined,
  kind: GoldPriceKind,
) {
  return queryOptions({
    queryKey: [...baseKey(scope), "rates-chart", period, purity, kind] as const,
    queryFn: ({ signal }) =>
      apiRequest<MarketSeries>(
        `${path(scope)}/rates/chart?period=${period}&purity=${purity}&kind=${kind}`,
        { signal },
      ),
    enabled: purity !== undefined,
    staleTime: 60_000,
  });
}

const historyKey = (scope: Scope) => [...baseKey(scope), "history"] as const;

export function goldRuleHistoryQuery(scope: Scope, page: CursorPage) {
  const params = new URLSearchParams({ limit: String(page.limit) });
  if (page.after) params.set("after", page.after);
  return queryOptions<GoldPriceRuleHistory, ApiError>({
    queryKey: [...historyKey(scope), page] as const,
    queryFn: ({ signal }) =>
      apiRequest<GoldPriceRuleHistory>(
        path(scope) + "/settings/history?" + params,
        { signal },
      ),
    staleTime: 60_000,
    retry: false,
  });
}

export function invalidateGoldPrices(
  client: QueryClient,
  organizationId: string,
) {
  return Promise.all(
    client
      .getQueriesData({ queryKey: ["gold-prices", organizationId] })
      .filter(([key]) => key[3] !== "history")
      .map(([queryKey]) => client.invalidateQueries({ queryKey, exact: true })),
  );
}

export function useChangeGoldPrice(
  scope: Scope,
  affectedKeys: (
    kind: GoldPricingChange["kind"],
  ) => readonly (readonly unknown[])[],
) {
  const client = useQueryClient();
  const refresh = ({ kind }: GoldPricingChange) =>
    Promise.all(
      [
        goldPricingQuery(scope).queryKey,
        goldCurrentRatesQuery(scope).queryKey,
        historyKey(scope),
        ...client
          .getQueryCache()
          .findAll({ queryKey: [...baseKey(scope), "rates-chart"] })
          .map(({ queryKey }) => queryKey),
        ...client
          .getQueriesData({ queryKey: [...baseKey(scope), "preview"] })
          .map(([key]) => key),
        ...affectedKeys(kind),
      ].map((queryKey) => client.invalidateQueries({ queryKey, exact: true })),
    );
  return useMutation({
    mutationKey: [...baseKey(scope), "save"],
    mutationFn: (body: GoldPricingChange) =>
      apiRequest<StoreGoldPriceRule>(`${path(scope)}/settings`, {
        method: "POST",
        body,
      }),
    onSuccess: (_result, change) => refresh(change),
    onError: (error: ApiError, change) => {
      if (error.isNetwork || error.status === 409) return refresh(change);
    },
    retry: false,
  });
}

export function goldPricingPreviewQuery(
  scope: Scope,
  draft: GoldPricingDraft | undefined,
  settingsRevision: string,
) {
  return queryOptions<GoldPricingPreview, ApiError>({
    queryKey: [...baseKey(scope), "preview", draft, settingsRevision],
    queryFn: ({ signal }) =>
      apiRequest(`${path(scope)}/settings/preview`, {
        method: "POST",
        body: draft,
        signal,
      }),
    enabled: !!draft,
    staleTime: 30_000,
    retry: false,
  });
}
