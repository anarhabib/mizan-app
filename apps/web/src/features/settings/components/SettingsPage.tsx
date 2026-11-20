import { useQuery } from "@tanstack/react-query";
import { Switch } from "radix-ui";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/features/workspace";
import { MoneyText } from "@/shared/ui/MoneyText";
import { PageHeader } from "@/shared/ui/PageHeader";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import {
  tradingSettingsQuery,
  useSaveSettings,
  type SettingsChange,
} from "../api/settings";
import { settingsErrorKey } from "../lib/form";
import { DeactivatePurity } from "./DeactivatePurity";
import { PurityForm, RateForm } from "./SettingsForms";

export function SettingsPage() {
  const workspace = useWorkspace();
  const { t } = useTranslation("settings");
  return (
    <>
      <PageHeader title={t("title")} />
      {workspace.role === "OWNER" ? (
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
    <p role="alert" className="rounded-lg border p-6">
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
  const mutation = useSaveSettings(scope);
  const save = async (change: SettingsChange) => {
    if (mutation.isPending) return false;
    try {
      await mutation.mutateAsync(change);
      return true;
    } catch {
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
        className="grid justify-items-start gap-3 rounded-lg border p-6"
      >
        <p>{t(settingsErrorKey(query.error))}</p>
        <Button
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="min-h-10 lg:min-h-8"
        >
          {t("retry")}
        </Button>
      </div>
    );
  }
  const { settings, purities, rates } = query.data;
  const activePurities = purities
    .filter((purity) => purity.active)
    .map(({ value }) => value);
  const busy = mutation.isPending;
  const error = mutation.error
    ? t(settingsErrorKey(mutation.error))
    : undefined;
  const change = mutation.variables;
  return (
    <div className="grid gap-6">
      <section
        aria-labelledby="settings-visibility-title"
        className="flex items-center justify-between gap-4 rounded-lg border p-4"
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
        <Switch.Root
          className="group flex min-h-10 w-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
        >
          <span className="flex h-6 w-full items-center rounded-full border border-border bg-muted p-0.5 group-data-[state=checked]:bg-primary">
            <Switch.Thumb className="size-4 rounded-full bg-muted-foreground transition-transform motion-reduce:transition-none data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground" />
          </span>
        </Switch.Root>
      </section>

      <section
        aria-labelledby="settings-purities-title"
        className="grid gap-4 rounded-lg border p-4"
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
                  <Badge variant={active ? "secondary" : "outline"}>
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
                  <Button
                    variant="outline"
                    className="min-h-10 lg:min-h-8"
                    disabled={busy}
                    aria-label={t("reactivatePurity", { value })}
                    onClick={() => void save({ action: "reactivate", value })}
                  >
                    {t("reactivate")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="settings-rates-title"
        className="grid gap-4 rounded-lg border p-4"
      >
        <h2
          id="settings-rates-title"
          className="font-heading text-base font-semibold"
        >
          {t("rates")}
        </h2>
        {activePurities.length === 0 ? (
          <p className="text-muted-foreground">{t("noActivePurities")}</p>
        ) : (
          <RateForm
            key={settings.defaultCurrency}
            currency={settings.defaultCurrency}
            purities={activePurities}
            busy={busy}
            save={(body) => save({ action: "addRate", body })}
          />
        )}
        {change?.action === "addRate" && error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {rates.length === 0 ? (
          <p className="text-muted-foreground">{t("noRates")}</p>
        ) : (
          <ul className="divide-y border-t">
            {rates.map((rate) => (
              <li
                key={rate.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[5rem_1fr_auto]"
              >
                <span className="tabular-nums">
                  {t("ratePurity", { value: rate.purity })}
                </span>
                <span className="col-start-1 row-start-2 min-w-0 break-all font-medium sm:col-start-2 sm:row-start-1">
                  <MoneyText
                    value={{
                      amount: rate.amountPerGram,
                      currency: rate.currency,
                    }}
                  />{" "}
                  {t("perGram")}
                </span>
                <Badge
                  className="col-start-2 row-start-1 justify-self-end sm:col-start-3"
                  variant={rate.current ? "secondary" : "outline"}
                >
                  {t(rate.current ? "current" : "historical")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      {busy && (
        <span role="status" className="sr-only">
          {t("saving")}
        </span>
      )}
    </div>
  );
}
