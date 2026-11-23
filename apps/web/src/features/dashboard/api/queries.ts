import { queryOptions } from "@tanstack/react-query";
import type {
  DashboardActivity,
  DashboardAgedStock,
  DashboardCharts,
  DashboardOwnerSummary,
  DashboardSummary,
  StoreContext,
} from "@mizan/contracts";
import { apiRequest } from "@/shared/lib/api";

export type DashboardScope = Pick<StoreContext, "organizationId" | "storeId">;

function query<T>(scope: DashboardScope, part: string, days?: number) {
  const { organizationId, storeId } = scope;
  const base = `/organizations/${encodeURIComponent(organizationId)}/stores/${encodeURIComponent(storeId)}/dashboard`;
  return queryOptions({
    queryKey: ["dashboard", organizationId, storeId, part, days] as const,
    queryFn: ({ signal }) =>
      apiRequest<T>(
        `${base}${part === "summary" ? "" : `/${part}`}${days ? `?days=${days}` : ""}`,
        { signal },
      ),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export const dashboardSummaryQuery = (scope: DashboardScope) =>
  query<DashboardSummary>(scope, "summary");
export const dashboardOwnerQuery = (scope: DashboardScope) =>
  query<DashboardOwnerSummary>(scope, "owner");
export const dashboardChartsQuery = (scope: DashboardScope) =>
  query<DashboardCharts>(scope, "charts");
export const dashboardActivityQuery = (scope: DashboardScope) =>
  query<DashboardActivity>(scope, "activity");
export const dashboardAgedStockQuery = (scope: DashboardScope, days: number) =>
  query<DashboardAgedStock>(scope, "aged-stock", days);
