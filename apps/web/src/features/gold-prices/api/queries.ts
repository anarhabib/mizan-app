import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  GoldMarketPrices,
  GoldPriceRuleHistory,
  GoldPricingChange,
  GoldPricingDraft,
  GoldPricingPreview,
  GoldPricingSettings,
  StoreGoldPriceRule,
  StoreContext,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";

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

const historyKey = (scope: Scope) => [...baseKey(scope), "history"] as const;

export function goldRuleHistoryQuery(scope: Scope) {
  return infiniteQueryOptions<
    GoldPriceRuleHistory,
    ApiError,
    InfiniteData<GoldPriceRuleHistory>,
    ReturnType<typeof historyKey>,
    string | undefined
  >({
    queryKey: historyKey(scope),
    initialPageParam: undefined,
    queryFn: ({ signal, pageParam }) =>
      apiRequest<GoldPriceRuleHistory>(
        `${path(scope)}/settings/history${pageParam ? `?after=${encodeURIComponent(pageParam)}` : ""}`,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor,
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
        historyKey(scope),
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
