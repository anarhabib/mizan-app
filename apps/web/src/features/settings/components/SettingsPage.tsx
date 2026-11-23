import { Spinner } from "@/components/ui/spinner";
import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, RotateCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoldPricingSection } from "@/features/gold-prices";
import { productKeys } from "@/features/products";
import { saleKeys } from "@/features/sales";
import { useWorkspace } from "@/features/workspace";
import { ApiError } from "@/shared/lib/api";
import { PageHeader } from "@/shared/ui/PageHeader";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import {
  tradingSettingsQuery,
  useSaveSettings,
  type SettingsChange,
} from "../api/settings";
import { settingsErrorKey } from "../lib/form";
import { DeactivatePurity } from "./DeactivatePurity";
import { CurrencySettingsForm } from "./CurrencySettingsForm";
import { PurityForm } from "./SettingsForms";

export function SettingsPage() {
  const workspace = useWorkspace();
  const { t } = useTranslation("settings");
  return (
    <>
      <PageHeader title={t("title")} />
      {workspace.canManageAsOwner ? (
        <OwnerSettings
          key={JSON.stringify([workspace.organizationId, workspace.storeId])}
          scope={workspace}
        />
      ) : (
        <AccessDenied />
      )}
    </>
  );
}

function AccessDenied() {
  const { t } = useTranslation("settings");
  return (
    <p role="alert" className="rounded-lg border border-border bg-card p-6">
      {t("accessDenied")}
    </p>
  );
}

function OwnerSettings({
  scope,
}: {
  scope: Pick<ReturnType<typeof useWorkspace>, "organizationId" | "storeId">;
}) {
  const { t } = useTranslation("settings");
  const query = useQuery(tradingSettingsQuery(scope));
  const client = useQueryClient();
  const mutation = useSaveSettings(scope);
  const save = async (change: SettingsChange) => {
    if (mutation.isPending) return false;
    try {
      await mutation.mutateAsync(change);
      toast.success(t("saved"));
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        const key = settingsErrorKey(error);
        if (key === "genericError" || key === "authUnavailable")
          toast.error(t(key));
      }
      return false;
    }
  };
  const denied = [query.error, mutation.error].some(
    (error) => error && settingsErrorKey(error) === "accessDenied",
  );
  if (denied) return <AccessDenied />;
  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="grid justify-items-start gap-3 rounded-lg border border-border bg-card p-6"
      >
        <p>{t(settingsErrorKey(query.error))}</p>
        <Button
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="min-h-10 lg:min-h-8"
        >
          <RotateCw aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>
    );
  }
  const { settings, purities } = query.data;
  const busy = mutation.isPending;
  const errorKey = mutation.error && settingsErrorKey(mutation.error);
  const error =
    errorKey && errorKey !== "genericError" && errorKey !== "authUnavailable"
      ? t(errorKey)
      : undefined;
  const change = mutation.variables;
  return (
    <div className="grid gap-6">
      <CurrencySettingsForm
        key={JSON.stringify([
          settings.defaultCurrency,
          settings.paymentCurrencies,
        ])}
        settings={settings}
        busy={busy}
        error={change?.action === "currencies" ? error : undefined}
        saving={busy && change?.action === "currencies"}
        save={(body) => void save({ action: "currencies", body })}
      />
      <section
        aria-labelledby="settings-visibility-title"
        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
      >
        <div>
          <h2
            id="settings-visibility-title"
            className="font-heading text-base font-semibold"
          >
            {t("costVisibility")}
          </h2>
          <p
            id="settings-visibility-description"
            className="mt-2 text-muted-foreground"
          >
            {t("costVisibilityDescription")}
          </p>
          {change?.action === "visibility" && error && (
            <p role="alert" className="mt-2 text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {busy && change?.action === "visibility" && (
            <Spinner
              aria-hidden="true"
              className="motion-reduce:animate-none"
            />
          )}
          <Switch
            size="default"
            className="relative shrink-0 after:absolute after:-inset-y-3 after:inset-x-0 motion-reduce:transition-none **:data-[slot=switch-thumb]:motion-reduce:transition-none"
            aria-labelledby="settings-visibility-title"
            aria-describedby="settings-visibility-description"
            checked={settings.salespersonCanViewAcquisitionCost}
            disabled={busy}
            onCheckedChange={(checked) =>
              void save({
                action: "visibility",
                body: { salespersonCanViewAcquisitionCost: checked },
              })
            }
          />
        </div>
      </section>

      <section
        aria-labelledby="settings-purities-title"
        className="grid gap-4 rounded-lg border border-border bg-card p-4"
      >
        <h2
          id="settings-purities-title"
          className="font-heading text-base font-semibold"
        >
          {t("purities")}
        </h2>
        <PurityForm
          busy={busy}
          save={(body) => save({ action: "addPurity", body })}
        />
        {(change?.action === "addPurity" ||
          change?.action === "reactivate" ||
          change?.action === "deactivate") &&
          error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        {purities.length === 0 ? (
          <p className="text-muted-foreground">{t("noPurities")}</p>
        ) : (
          <ul className="divide-y border-t">
            {purities.map(({ value, active }) => (
              <li
                key={value}
                className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">{value}</span>
                  <Badge variant={active ? "success" : "danger"}>
                    {t(active ? "active" : "inactive")}
                  </Badge>
                </div>
                {active ? (
                  <DeactivatePurity
                    value={value}
                    busy={busy}
                    error={
                      change?.action === "deactivate" && change.value === value
                        ? error
                        : undefined
                    }
                    save={() => save({ action: "deactivate", value })}
                  />
                ) : (
                  <PendingButton
                    pending={
                      busy &&
                      change?.action === "reactivate" &&
                      change.value === value
                    }
                    variant="success"
                    className="min-h-10 lg:min-h-8"
                    disabled={busy}
                    aria-label={t("reactivatePurity", { value })}
                    onClick={() => void save({ action: "reactivate", value })}
                  >
                    {!(
                      busy &&
                      change?.action === "reactivate" &&
                      change.value === value
                    ) && <RotateCcw aria-hidden="true" />}
                    {t("reactivate")}
                  </PendingButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <GoldPricingSection
        scope={scope}
        affectedKeys={(kind) => {
          if (kind === "SCRAP_BUY") return [saleKeys.options(scope)];
          if (kind === "RETAIL_SELL")
            return client
              .getQueriesData({ queryKey: productKeys.details(scope) })
              .map(([key]) => key);
          return [];
        }}
      />

      {busy && (
        <span role="status" className="sr-only">
          {t("saving")}
        </span>
      )}
    </div>
  );
}
