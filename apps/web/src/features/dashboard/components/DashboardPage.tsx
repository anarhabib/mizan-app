import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth";
import { goldMarketQuery } from "@/features/gold-prices";
import { useWorkspace } from "@/features/workspace";
import { PageHeader } from "@/shared/ui/PageHeader";
import {
  dashboardActivityQuery,
  dashboardAgedStockQuery,
  dashboardChartsQuery,
  dashboardOwnerQuery,
  dashboardSummaryQuery,
  type DashboardScope,
} from "../api/queries";
import {
  defaultPreferences,
  ownerWidgets,
  preferenceKey,
  readPreferences,
  visibleWidgets,
  type Preferences,
  type WidgetId,
} from "../preferences";
import {
  activityWidgets,
  ActivityWidget,
  AgedStock,
  chartWidgets,
  ChartWidget,
  OwnerMetric,
  QuickActions,
  SummaryWidget,
  summaryWidgets,
} from "./BusinessWidgets";
import { CustomizeDashboard } from "./CustomizeDashboard";
import { DashboardCard, QueryContent } from "./DashboardCard";
import { formatMarketTime } from "./DashboardCharts";
import { ExchangeWidget, GoldWidget, StoreRatesWidget } from "./MarketWidgets";

export function DashboardPage() {
  const { userId } = useSession();
  const { organizationId, storeId, canManageAsOwner } = useWorkspace();
  if (!userId) return null;
  const storageKey = preferenceKey(userId, organizationId, storeId);
  return (
    <ScopedDashboard
      key={storageKey}
      scope={{ organizationId, storeId }}
      owner={canManageAsOwner}
      storageKey={storageKey}
    />
  );
}

function inGroup<T extends WidgetId>(
  id: WidgetId,
  group: readonly T[],
): id is T {
  return group.some((item) => item === id);
}

function ScopedDashboard({
  scope,
  owner,
  storageKey,
}: {
  scope: DashboardScope;
  owner: boolean;
  storageKey: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const [preferences, setPreferences] = useState(() => {
    try {
      return readPreferences(localStorage, storageKey);
    } catch {
      return defaultPreferences();
    }
  });
  const [opener, setOpener] = useState<HTMLElement>();
  const visible = visibleWidgets(preferences, owner);
  const enabled = (group: readonly WidgetId[]) =>
    visible.some((id) => group.includes(id));
  const summary = useQuery({
    ...dashboardSummaryQuery(scope),
    enabled: enabled(summaryWidgets),
  });
  const financials = useQuery({
    ...dashboardOwnerQuery(scope),
    enabled: owner && enabled(ownerWidgets),
  });
  const charts = useQuery({
    ...dashboardChartsQuery(scope),
    enabled: enabled(chartWidgets),
  });
  const activity = useQuery({
    ...dashboardActivityQuery(scope),
    enabled: enabled(activityWidgets),
  });
  const aged = useQuery({
    ...dashboardAgedStockQuery(scope, preferences.agedDays),
    enabled: visible.includes("agedStock"),
  });
  const gold = useQuery({ ...goldMarketQuery(scope), enabled: !!opener });
  const marketDefaults = `${preferences.period}/${preferences.unit}/${preferences.purity}`;

  function save(next: Preferences) {
    setPreferences(next);
    setOpener(undefined);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      toast.success(t("saved"));
    } catch {
      toast.warning(t("storageError"));
    }
  }

  function renderWidget(id: WidgetId) {
    if (id === "actions") return <QuickActions key={id} owner={owner} />;
    if (id === "gold")
      return (
        <GoldWidget
          key={`${id}/${marketDefaults}`}
          scope={scope}
          preferences={preferences}
        />
      );
    if (id === "exchange") return <ExchangeWidget key={id} scope={scope} />;
    if (id === "storeRates")
      return (
        <StoreRatesWidget
          key={`${id}/${marketDefaults}`}
          scope={scope}
          preferences={preferences}
        />
      );
    return (
      <DashboardCard key={id} title={t(`widgets.${id}`)}>
        {inGroup(id, summaryWidgets) && (
          <QueryContent query={summary}>
            {(data) => <SummaryWidget data={data} kind={id} />}
          </QueryContent>
        )}
        {owner && inGroup(id, ownerWidgets) && (
          <QueryContent query={financials}>
            {(data) => <OwnerMetric data={data[id]} />}
          </QueryContent>
        )}
        {inGroup(id, chartWidgets) && (
          <QueryContent query={charts}>
            {(data) => <ChartWidget data={data} kind={id} />}
          </QueryContent>
        )}
        {inGroup(id, activityWidgets) && (
          <QueryContent query={activity}>
            {(data) => <ActivityWidget data={data} kind={id} />}
          </QueryContent>
        )}
        {id === "agedStock" && (
          <QueryContent query={aged}>
            {(data) => <AgedStock data={data} days={preferences.agedDays} />}
          </QueryContent>
        )}
      </DashboardCard>
    );
  }
  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button
            variant="outline"
            className="min-h-10 lg:min-h-9"
            onClick={(event) => setOpener(event.currentTarget)}
          >
            <SlidersHorizontal aria-hidden="true" />
            {t("customize")}
          </Button>
        }
      />
      {summary.data && (
        <p className="-mt-3 mb-4 text-xs text-muted-foreground">
          {t("date", {
            date: formatMarketTime(
              summary.data.day,
              i18n.resolvedLanguage ?? "az",
              false,
            ),
          })}
        </p>
      )}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {visible.map(renderWidget)}
      </div>
      {opener && (
        <CustomizeDashboard
          current={preferences}
          owner={owner}
          purities={gold.data?.references.map(({ purity }) => purity) ?? []}
          opener={opener}
          close={() => setOpener(undefined)}
          save={save}
        />
      )}
    </>
  );
}
