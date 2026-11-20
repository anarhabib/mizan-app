import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  OrganizationSettings,
  StoreContext,
  TradingSettings,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import type { RateInput } from "../lib/form";

type SettingsScope = Pick<StoreContext, "organizationId" | "storeId">;

export const settingsKey = ({ organizationId, storeId }: SettingsScope) =>
  ["settings", organizationId, storeId, "trading"] as const;

const organizationPath = ({ organizationId }: SettingsScope) =>
  `/organizations/${encodeURIComponent(organizationId)}`;

export function tradingSettingsQuery(scope: SettingsScope) {
  return queryOptions<TradingSettings, ApiError>({
    queryKey: settingsKey(scope),
    queryFn: ({ signal }) =>
      apiRequest<TradingSettings>(`${organizationPath(scope)}/settings`, {
        signal,
      }),
    staleTime: 60_000,
    retry: false,
  });
}

type CostVisibility = Pick<
  OrganizationSettings,
  "salespersonCanViewAcquisitionCost"
>;
export type SettingsChange =
  | { action: "visibility"; body: CostVisibility }
  | { action: "addPurity"; body: { value: number } }
  | { action: "deactivate" | "reactivate"; value: number }
  | { action: "addRate"; body: RateInput };

function saveSettings(scope: SettingsScope, change: SettingsChange) {
  const base = organizationPath(scope);
  switch (change.action) {
    case "visibility":
      return apiRequest<unknown>(`${base}/settings`, {
        method: "POST",
        body: change.body,
      });
    case "addPurity":
      return apiRequest<unknown>(`${base}/purities`, {
        method: "POST",
        body: change.body,
      });
    case "deactivate":
    case "reactivate":
      return apiRequest<unknown>(
        `${base}/purities/${change.value}/${change.action}`,
        { method: "POST" },
      );
    case "addRate":
      return apiRequest<unknown>(`${base}/rates`, {
        method: "POST",
        body: change.body,
      });
  }
}

export function useSaveSettings(scope: SettingsScope) {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: settingsKey(scope), exact: true });

  return useMutation({
    mutationKey: [...settingsKey(scope), "save"],
    mutationFn: (change: SettingsChange) => saveSettings(scope, change),
    retry: false,
    onSuccess: refresh,
    onError: (error: ApiError) => {
      if (error.isNetwork || error.code === "PURITY_CONFLICT") return refresh();
    },
  });
}
