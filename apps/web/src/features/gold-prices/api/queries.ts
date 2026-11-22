import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  GoldMarketPrices,
  GoldPricingChange,
  GoldPricingPreview,
  GoldPricingSettings,
  StoreGoldPrice,
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
    refetchInterval: 15 * 60_000,
    retry: false,
  });
}

export function invalidateGoldPrices(
  client: QueryClient,
  organizationId: string,
  settingsOnly = false,
) {
  return Promise.all(
    client
      .getQueriesData({ queryKey: ["gold-prices", organizationId] })
      .filter(([key]) => !settingsOnly || key[3] === "settings")
      .map(([queryKey]) => client.invalidateQueries({ queryKey, exact: true })),
  );
}

export function useChangeGoldPrice(scope: Scope) {
  const client = useQueryClient();
  const refresh = () =>
    invalidateGoldPrices(client, scope.organizationId, true);
  return useMutation({
    mutationKey: [...baseKey(scope), "save"],
    mutationFn: (body: GoldPricingChange) =>
      apiRequest<StoreGoldPrice>(`${path(scope)}/settings`, {
        method: "POST",
        body,
      }),
    onSuccess: refresh,
    onError: (error: ApiError) => {
      if (error.isNetwork || error.status === 409) return refresh();
    },
    retry: false,
  });
}

export function goldPricingPreviewQuery(
  scope: Scope,
  draft:
    Pick<GoldPricingChange, "kind" | "mode" | "purity" | "value"> | undefined,
  quoteId: string | undefined,
) {
  return queryOptions<GoldPricingPreview, ApiError>({
    queryKey: [...baseKey(scope), "preview", draft, quoteId],
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
