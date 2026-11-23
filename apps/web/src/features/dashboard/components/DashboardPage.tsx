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
  groupWidgets,
  ownerWidgets,
  preferenceKey,
  readPreferences,
  showQuickActions,
  visibleWidgets,
  type Preferences,
  type BusinessWidgetId,
  type WidgetGroupId,
} from "../preferences";
import {
  activityWidgets,
  ActivityWidget,
  AgedStock,
  chartWidgets,
  ChartWidget,
  OwnerMetric,
  SummaryWidget,
  summaryWidgets,
} from "./BusinessWidgets";
import { CustomizeDashboard } from "./CustomizeDashboard";
import { DashboardCard, QueryContent } from "./DashboardCard";
import { formatMarketTime } from "./DashboardCharts";
import { ExchangeWidget, GoldWidget, StoreRatesWidget } from "./MarketWidgets";
import { DashboardWidgetGrid } from "./DashboardWidgetGrid";
import { QuickActions } from "./QuickActions";
import { Skeleton } from "@/components/ui/skeleton";

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

function inGroup<T extends BusinessWidgetId>(
  id: BusinessWidgetId,
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
  const [previewOrder, setPreviewOrder] = useState<WidgetGroupId[]>();
  const visible = visibleWidgets(preferences, owner);
  const enabled = (group: readonly BusinessWidgetId[]) =>
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
  function storePreferences(next: Preferences) {
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  function closeCustomization() {
    setOpener(undefined);
    setPreviewOrder(undefined);
  }

  function save(next: Preferences) {
    closeCustomization();
    if (storePreferences(next)) toast.success(t("saved"));
    else toast.warning(t("storageError"));
  }

  function renderWidget(id: BusinessWidgetId) {
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
          <QueryContent query={summary} rows={id === "inventory" ? 3 : 4}>
            {(data) => <SummaryWidget data={data} kind={id} />}
          </QueryContent>
        )}
        {owner && inGroup(id, ownerWidgets) && (
          <QueryContent query={financials} rows={1}>
            {(data) => (
              <OwnerMetric
                data={data[id]}
                comparison={
                  id === "grossProfit"
                    ? (data.grossProfitComparison ?? [])
                    : undefined
                }
              />
            )}
          </QueryContent>
        )}
        {inGroup(id, chartWidgets) && (
          <QueryContent
            query={charts}
            chart={id === "salesTrend" || id === "paymentTrend"}
          >
            {(data) => (
              <ChartWidget
                data={data}
                kind={id}
                salesMetric={preferences.salesMetric}
                changeSalesMetric={(salesMetric) => {
                  if (!storePreferences({ ...preferences, salesMetric }))
                    toast.warning(t("storageError"));
                }}
              />
            )}
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
      {showQuickActions(preferences) && (
        <div className="mb-4">
          <QuickActions owner={owner} />
        </div>
      )}
      {enabled(summaryWidgets) && (
        <div className="-mt-2 mb-4 min-h-4 text-xs text-muted-foreground">
          {summary.data ? (
            t("date", {
              date: formatMarketTime(
                summary.data.day,
                i18n.resolvedLanguage ?? "az",
                false,
              ),
            })
          ) : summary.isPending ? (
            <Skeleton className="h-4 w-32" />
          ) : null}
        </div>
      )}
      <div className="space-y-4 lg:space-y-6">
        {groupWidgets(visible, previewOrder ?? preferences.groupOrder).map(
          ({ id, widgets }) => (
            <section
              key={id}
              aria-labelledby={`dashboard-group-${id}`}
              className="min-w-0 space-y-2"
            >
              <h2
                id={`dashboard-group-${id}`}
                className="border-b pb-2 text-sm font-semibold"
              >
                {t(`groups.${id}`)}
              </h2>
              <DashboardWidgetGrid
                widgets={widgets}
                renderWidget={renderWidget}
              />
            </section>
          ),
        )}
      </div>
      {opener && (
        <CustomizeDashboard
          current={preferences}
          owner={owner}
          purities={gold.data?.references.map(({ purity }) => purity) ?? []}
          opener={opener}
          close={closeCustomization}
          previewGroupOrder={setPreviewOrder}
          save={save}
        />
      )}
    </>
  );
}
