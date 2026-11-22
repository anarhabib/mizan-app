import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  OrganizationSettings,
  CurrencySettings,
  StoreContext,
  TradingSettings,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import { invalidateGoldPrices } from "@/features/gold-prices";

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
  | { action: "currencies"; body: CurrencySettings }
  | { action: "addPurity"; body: { value: number } }
  | { action: "deactivate" | "reactivate"; value: number };

function saveSettings(scope: SettingsScope, change: SettingsChange) {
  const base = organizationPath(scope);
  switch (change.action) {
    case "currencies":
      return apiRequest<CurrencySettings>(`${base}/settings/currencies`, {
        method: "POST",
        body: change.body,
      });
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
  }
}

export function useSaveSettings(scope: SettingsScope) {
  const client = useQueryClient();
  const refresh = (change: SettingsChange) => {
    const settings = client.invalidateQueries({
      queryKey: settingsKey(scope),
      exact: true,
    });
    if (change.action === "currencies") {
      const keys = client
        .getQueryCache()
        .findAll()
        .map(({ queryKey }) => queryKey)
        .filter(
          (key) =>
            key[1] === scope.organizationId &&
            ((key[0] === "store" &&
              key[3] === "workspace" &&
              key[4] === "access") ||
              (key[0] === "sales" && key[3] === "options") ||
              (key[0] === "products" &&
                (key[3] === "detail" || key[3] === "options"))),
        );
      return Promise.all([
        settings,
        ...keys.map((queryKey) =>
          client.invalidateQueries({ queryKey, exact: true }),
        ),
      ]);
    }
    if (
      change.action === "addPurity" ||
      change.action === "deactivate" ||
      change.action === "reactivate"
    )
      return Promise.all([
        settings,
        invalidateGoldPrices(client, scope.organizationId),
        ...client
          .getQueryCache()
          .findAll()
          .filter(
            ({ queryKey: key }) =>
              key[1] === scope.organizationId &&
              ((key[0] === "sales" && key[3] === "options") ||
                (key[0] === "products" &&
                  (key[3] === "detail" || key[3] === "options"))),
          )
          .map(({ queryKey }) =>
            client.invalidateQueries({ queryKey, exact: true }),
          ),
      ]);
    return settings;
  };

  return useMutation({
    mutationKey: [...settingsKey(scope), "save"],
    mutationFn: (change: SettingsChange) => saveSettings(scope, change),
    retry: false,
    onSuccess: (_result, change) => refresh(change),
    onError: (error: ApiError, change) => {
      if (error.isNetwork || error.code === "PURITY_CONFLICT")
        return refresh(change);
    },
  });
}
