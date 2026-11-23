import { queryOptions } from "@tanstack/react-query";
import type {
  ExchangeRatesResponse,
  OfficialRateHistory,
  StoreContext,
} from "@mizan/contracts";
import { apiRequest } from "@/shared/lib/api";

export type ExchangeRateScope = Pick<
  StoreContext,
  "organizationId" | "storeId"
>;

export function exchangeRatesQuery({
  organizationId,
  storeId,
}: ExchangeRateScope) {
  return queryOptions({
    queryKey: ["exchange-rates", organizationId, storeId] as const,
    queryFn: ({ signal }) =>
      apiRequest<ExchangeRatesResponse>(
        `/organizations/${encodeURIComponent(organizationId)}/stores/${encodeURIComponent(storeId)}/exchange-rates`,
        { signal },
      ),
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });
}

export function exchangeHistoryQuery(
  { organizationId, storeId }: ExchangeRateScope,
  date?: string,
) {
  return queryOptions({
    queryKey: [
      "exchange-rates",
      organizationId,
      storeId,
      "history",
      date,
    ] as const,
    queryFn: ({ signal }) =>
      apiRequest<OfficialRateHistory>(
        `/organizations/${encodeURIComponent(organizationId)}/stores/${encodeURIComponent(storeId)}/exchange-rates/history`,
        { signal },
      ),
    staleTime: 15 * 60_000,
    retry: false,
  });
}
