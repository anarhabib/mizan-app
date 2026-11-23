import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type {
  DashboardActivity,
  DashboardAgedStock,
  DashboardCharts,
  DashboardOwnerSummary,
  DashboardSummary,
  MoneyInput,
} from "@mizan/contracts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ContactRound,
  PackagePlus,
  ReceiptText,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatWeight } from "@/shared/lib/format";
import { DashboardCard } from "./DashboardCard";
import {
  DistributionChart,
  WeeklyChart,
  formatMarketTime,
} from "./DashboardCharts";

type Value = MoneyInput[] | MoneyInput | number | string | null;

function Values({
  value,
  absent,
}: {
  value: Value;
  absent?: "empty" | "unavailable";
}) {
  const { t, i18n } = useTranslation("dashboard");
  const locale = i18n.resolvedLanguage ?? "az";
  if (value === null || (Array.isArray(value) && !value.length))
    return (
      <span className="text-sm font-normal text-muted-foreground">
        {value === null || absent ? t("unavailable") : "—"}
      </span>
    );
  if (typeof value === "number") return value.toLocaleString(locale);
  if (typeof value === "string") return value;
  const amounts = Array.isArray(value) ? value : [value];
  return amounts.map((amount) => (
    <span key={amount.currency} className="block wrap-anywhere">
      {formatMoney(amount, locale)}
    </span>
  ));
}

function Metric({
  label,
  value,
  previous,
}: {
  label: string;
  value: Value;
  previous?: Value;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <div className="min-w-0 space-y-1 rounded-md border bg-background/35 p-3">
      <dt className="text-xs leading-snug text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold leading-snug wrap-anywhere tabular-nums">
        <Values value={value} />
      </dd>
      {previous !== undefined && (
        <dd className="text-xs tabular-nums text-muted-foreground">
          <span className="sr-only">{t("vsPrevious")} </span>
          <Values value={previous} />
        </dd>
      )}
    </div>
  );
}

export const summaryWidgets = [
  "sales",
  "payments",
  "debt",
  "intake",
  "inventory",
] as const;
type SummaryWidget = (typeof summaryWidgets)[number];

function methodKey(method: string) {
  return method === "CASH" || method === "CARD" || method === "TRANSFER"
    ? method
    : "LEGACY";
}

export function SummaryWidget({
  data,
  kind,
}: {
  data: DashboardSummary;
  kind: SummaryWidget;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const locale = i18n.resolvedLanguage;
  const { sales, previousSales, payments, debt, intake, inventory } = data;
  const comparison = previousSales.count > 0;
  const series: Record<SummaryWidget, ReactNode> = {
    sales: (
      <>
        <Metric
          label={t("saleTotal")}
          value={sales.total}
          previous={comparison ? previousSales.total : undefined}
        />
        <Metric
          label={t("saleCount")}
          value={sales.count}
          previous={comparison ? previousSales.count : undefined}
        />
        <Metric
          label={t("productsSold")}
          value={sales.products}
          previous={comparison ? previousSales.products : undefined}
        />
        <Metric
          label={t("average")}
          value={sales.average}
          previous={comparison ? previousSales.average : undefined}
        />
      </>
    ),
    payments: (
      <>
        <Metric label={t("received")} value={payments.total} />
        <Metric label={t("normalized")} value={payments.normalized} />
        <Metric label={t("repayments")} value={payments.repayments} />
        <Metric label={t("tradeCredit")} value={payments.tradeInCredit} />
        {payments.methods.map(({ method, total }) => (
          <Metric key={method} label={t(methodKey(method))} value={total} />
        ))}
      </>
    ),
    debt: (
      <>
        <Metric label={t("newDebt")} value={debt.new} />
        <Metric label={t("outstanding")} value={debt.outstanding} />
        <Metric label={t("customerCount")} value={debt.customers} />
        <Metric label={t("partiallyPaid")} value={debt.partial} />
        <Metric label={t("unpaid")} value={debt.unpaid} />
      </>
    ),
    intake: (
      <>
        <Metric label={t("intakeCount")} value={intake.count} />
        <Metric
          label={t("intakeWeight")}
          value={formatWeight(intake.weight, locale)}
        />
        <Metric
          label={t("tradeWeight")}
          value={formatWeight(intake.tradeInWeight, locale)}
        />
        <Metric label={t("tradeValue")} value={intake.tradeInValue} />
      </>
    ),
    inventory: (
      <>
        <Metric label={t("stockCount")} value={inventory.count} />
        <Metric
          label={t("stockWeight")}
          value={formatWeight(inventory.weight, locale)}
        />
        <Metric label={t("marketValue")} value={inventory.marketValue} />
      </>
    ),
  };
  return (
    <>
      {kind === "sales" && comparison && (
        <p className="text-xs text-muted-foreground">{t("vsPrevious")}</p>
      )}
      <dl className="grid grid-cols-2 gap-2">{series[kind]}</dl>
    </>
  );
}

export function OwnerMetric({
  data,
}: {
  data: DashboardOwnerSummary[keyof DashboardOwnerSummary];
}) {
  return (
    <p className="text-xl font-semibold tabular-nums">
      <Values value={data} />
    </p>
  );
}

export const chartWidgets = [
  "salesTrend",
  "salesCount",
  "paymentTrend",
  "categories",
  "paymentMethods",
  "distribution",
  "settlement",
] as const;
type ChartWidgetId = (typeof chartWidgets)[number];
export function ChartWidget({
  data,
  kind,
}: {
  data: DashboardCharts;
  kind: ChartWidgetId;
}) {
  const { t } = useTranslation("dashboard");
  const [dimension, setDimension] = useState("purity");
  if (kind === "salesCount" || kind === "salesTrend" || kind === "paymentTrend")
    return (
      <WeeklyChart
        days={data.days}
        kind={
          kind === "salesCount"
            ? "count"
            : kind === "salesTrend"
              ? "sales"
              : "payments"
        }
      />
    );

  const distributions = {
    categories: data.categories,
    paymentMethods: data.methods.map(({ label, count }) => ({
      label: t(methodKey(label)),
      count,
    })),
    distribution:
      dimension === "purity" ? data.purities : data.inventoryCategories,
    settlement: [
      { label: t("paid"), count: data.settlement.PAID },
      { label: t("partiallyPaid"), count: data.settlement.PARTIALLY_PAID },
      { label: t("unpaid"), count: data.settlement.UNPAID },
    ],
  };
  return (
    <>
      {kind === "distribution" ? (
        <Select value={dimension} onValueChange={setDimension}>
          <SelectTrigger
            className="min-h-10"
            aria-label={t("widgets.distribution")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="purity">{t("purityShort")}</SelectItem>
            <SelectItem value="category">{t("category")}</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <p className="text-xs text-muted-foreground">{t("lastSeven")}</p>
      )}
      <DistributionChart rows={distributions[kind]} />
    </>
  );
}

const activityKinds = {
  recentSales: "sale",
  recentIntake: "intake",
  recentTradeIns: "tradeIn",
  recentRepayments: "repayment",
} as const;
export const activityWidgets = [
  "activity",
  "debtors",
  "recentSales",
  "recentIntake",
  "recentTradeIns",
  "recentRepayments",
] as const;
type ActivityWidgetId = (typeof activityWidgets)[number];
const activityLink =
  "inline-flex min-h-10 items-center rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8";

export function ActivityWidget({
  data,
  kind,
}: {
  data: DashboardActivity;
  kind: ActivityWidgetId;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const locale = i18n.resolvedLanguage ?? "az";
  if (kind === "debtors")
    return (
      <>
        {data.debtors.length === 0 && (
          <p className="text-muted-foreground">{t("empty")}</p>
        )}
        <ul className="divide-y">
          {data.debtors.map(({ id, name, outstanding }) => (
            <li
              key={id}
              className="flex items-center justify-between gap-3 py-1"
            >
              <Link
                to="/customers"
                search={{ customer: id }}
                className={`${activityLink} wrap-anywhere`}
              >
                {name}
              </Link>
              <span className="shrink-0 text-sm tabular-nums">
                {formatMoney(outstanding, locale)}
              </span>
            </li>
          ))}
        </ul>
        <Link
          to="/customers"
          search={{ outstanding: true }}
          className={activityLink}
        >
          {t("viewDebtors")}{" "}
          <ArrowUpRight className="ml-1 size-3.5" aria-hidden="true" />
        </Link>
      </>
    );
  const entries =
    kind === "activity"
      ? data.items.slice(0, 6)
      : data.items.filter((entry) => entry.kind === activityKinds[kind]);
  if (!entries.length)
    return <p className="text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="divide-y">
      {entries.map((item) => (
        <li
          key={`${item.kind}/${item.id}`}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1"
        >
          <div className="min-w-0">
            {item.kind === "intake" ? (
              <Link
                to="/products"
                search={{ product: item.recordId }}
                className={`${activityLink} wrap-anywhere`}
              >
                {item.label}
              </Link>
            ) : (
              <Link
                to="/sales"
                search={{ sale: item.recordId }}
                className={`${activityLink} wrap-anywhere`}
              >
                {item.label}
              </Link>
            )}
            <p className="pb-1 text-xs text-muted-foreground">
              {t(item.kind)} ·{" "}
              <time dateTime={item.at}>
                {formatMarketTime(item.at, locale)}
              </time>
            </p>
          </div>
          {item.value && (
            <span className="text-right text-sm tabular-nums">
              {formatMoney(item.value, locale)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AgedStock({
  data,
  days,
}: {
  data: DashboardAgedStock;
  days: number;
}) {
  const { t, i18n } = useTranslation("dashboard");
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t("agedCount", { count: data.count, days })}
      </p>
      <ul className="divide-y">
        {data.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <Link
              to="/products"
              search={{ product: item.id }}
              className={`${activityLink} wrap-anywhere`}
            >
              {item.name} · {item.code}
            </Link>
            <time
              dateTime={item.receivedAt}
              className="shrink-0 text-xs text-muted-foreground"
            >
              {formatMarketTime(
                item.receivedAt,
                i18n.resolvedLanguage ?? "az",
                false,
              )}
            </time>
          </li>
        ))}
      </ul>
    </>
  );
}

export function QuickActions({ owner }: { owner: boolean }) {
  const { t } = useTranslation(["dashboard", "products", "customers"]);
  const action = "min-h-10 justify-start px-3! lg:min-h-9";
  return (
    <DashboardCard title={t("widgets.actions")} wide>
      <div className="flex flex-wrap gap-2">
        <Button asChild className={action}>
          <Link to="/products" search={{ intent: "sale" }}>
            <ReceiptText />
            {t("recordSale")}
          </Link>
        </Button>
        <Button asChild className={action} variant="outline">
          <Link to="/products" search={{ intent: "create" }}>
            <PackagePlus />
            {t("create", { ns: "products" })}
          </Link>
        </Button>
        <Button asChild className={action} variant="outline">
          <Link to="/products" hash="product-search">
            <Search />
            {t("find")}
          </Link>
        </Button>
        <Button asChild className={action} variant="outline">
          <Link to="/customers" search={{ create: true }}>
            <ContactRound />
            {t("create", { ns: "customers" })}
          </Link>
        </Button>
        <Button asChild className={action} variant="outline">
          <Link to="/customers" search={{ outstanding: true }}>
            <ArrowDownLeft />
            {t("viewDebtors")}
          </Link>
        </Button>
        {owner && (
          <Button asChild className={action} variant="outline">
            <Link to="/settings" hash="gold-pricing">
              <Settings />
              {t("pricingSettings")}
            </Link>
          </Button>
        )}
      </div>
    </DashboardCard>
  );
}
