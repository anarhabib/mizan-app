import { useState, type ReactNode } from "react";
import { categoryLabel } from "@mizan/contracts";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type {
  DashboardActivity,
  DashboardCount,
  DashboardAgedStock,
  DashboardCharts,
  DashboardOwnerSummary,
  DashboardComparison,
  DashboardMoneyComparison,
  DashboardSummary,
  MoneyInput,
  SalePaymentStatus,
} from "@mizan/contracts";
import { ArrowUpRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDecimal, formatMoney, formatWeight } from "@/shared/lib/format";
import { financialTone, Trend, type FinancialMeaning } from "./FinancialValues";
import {
  DistributionChart,
  WeeklyChart,
  formatMarketTime,
} from "./DashboardCharts";

type Value = MoneyInput[] | MoneyInput | number | string | null;

function Values({
  value,
  meaning = "neutral",
}: {
  value: Value;
  meaning?: FinancialMeaning;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const locale = i18n.resolvedLanguage ?? "az";
  if (value === null || (Array.isArray(value) && !value.length))
    return (
      <span className="text-sm font-normal text-muted-foreground">
        {value === null ? t("unavailable") : "—"}
      </span>
    );
  if (typeof value === "number") return value.toLocaleString(locale);
  if (typeof value === "string") return value;
  const amounts = Array.isArray(value) ? value : [value];
  return amounts.map((amount) => {
    const { sign, className } = financialTone(meaning, amount.amount);
    return (
      <span
        key={amount.currency}
        className={`block wrap-anywhere ${className}`}
      >
        {sign}
        {formatMoney(amount, locale)}
      </span>
    );
  });
}

type MetricLink =
  | {
      to: "/sales";
      search: {
        date?: string;
        paymentDate?: string;
        paymentStatus?: SalePaymentStatus;
      };
    }
  | { to: "/customers"; search: { outstanding: true } }
  | {
      to: "/products";
      search: {
        status?: "SOLD" | "IN_STOCK";
        soldOn?: string;
        receivedOn?: string;
        agedDays?: number;
      };
    };

function Metric({
  label,
  value,
  meaning,
  comparison,
  link,
  primary = false,
}: {
  label: string;
  value: Value;
  meaning?: FinancialMeaning;
  comparison?: DashboardComparison | DashboardMoneyComparison[] | null;
  link?: MetricLink;
  primary?: boolean;
}) {
  const labelStyle = "min-w-0 wrap-anywhere text-sm leading-snug";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-x-3 py-2 first:pt-0 last:pb-0">
      <dt className={labelStyle}>
        {link ? (
          <Link
            {...link}
            className="inline-flex min-h-10 items-center gap-1 rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring lg:min-h-7"
          >
            {label}
            <ArrowUpRight
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Link>
        ) : (
          <span className="text-muted-foreground">{label}</span>
        )}
      </dt>
      <dd
        className={`min-w-0 text-right font-semibold leading-snug wrap-anywhere tabular-nums ${primary ? "text-lg" : "text-sm"}`}
      >
        <Values value={value} meaning={meaning} />
      </dd>
      {comparison !== undefined && (
        <dd className="col-span-2 text-right text-xs">
          <DailyComparison
            comparison={comparison}
            currency={
              typeof value === "object" && value && !Array.isArray(value)
                ? value.currency
                : undefined
            }
          />
        </dd>
      )}
    </div>
  );
}

function DailyComparison({
  comparison,
  currency,
}: {
  comparison: DashboardComparison | DashboardMoneyComparison[] | null;
  currency?: string;
}) {
  const { i18n } = useTranslation("dashboard");
  const locale = i18n.resolvedLanguage ?? "az";
  const movements = Array.isArray(comparison) ? comparison : [comparison];
  return (movements.length ? movements : [null]).map(
    (movement: (DashboardComparison & { currency?: string }) | null) => {
      const code = movement?.currency ?? currency;
      return (
        <div key={code ?? "count"}>
          <Trend
            daily
            movement={movement}
            format={(amount) =>
              code
                ? formatMoney({ amount, currency: code }, locale)
                : formatDecimal(amount, locale)
            }
          />
        </div>
      );
    },
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
  const { sales, payments, debt, intake, inventory, comparison, day } = data;
  const completed = { to: "/sales", search: { date: day } } as const;
  const receipts = { to: "/sales", search: { paymentDate: day } } as const;
  const debtors = { to: "/customers", search: { outstanding: true } } as const;
  const received = { to: "/products", search: { receivedOn: day } } as const;
  const stock = { to: "/products", search: { status: "IN_STOCK" } } as const;
  const series: Record<SummaryWidget, ReactNode> = {
    sales: (
      <>
        <Metric
          label={t("saleTotal")}
          value={sales.total}
          link={completed}
          primary
          comparison={comparison?.sales ?? null}
        />
        <Metric
          label={t("saleCount")}
          value={sales.count}
          link={completed}
          comparison={comparison?.saleCount ?? null}
        />
        <Metric
          label={t("productsSold")}
          value={sales.products}
          link={{ to: "/products", search: { status: "SOLD", soldOn: day } }}
        />
        <Metric label={t("average")} value={sales.average} />
      </>
    ),
    payments: (
      <>
        <Metric
          label={t("received")}
          value={payments.total}
          meaning="inflow"
          link={receipts}
          primary
        />
        <Metric
          label={t("normalized")}
          value={payments.normalized}
          meaning="inflow"
          comparison={comparison?.receipts ?? null}
        />
        <Metric
          label={t("repayments")}
          value={payments.repayments}
          meaning="inflow"
        />
        <Metric label={t("tradeCredit")} value={payments.tradeInCredit} />
        {!!payments.payouts?.length && (
          <Metric
            label={t("payouts")}
            value={payments.payouts}
            meaning="outflow"
          />
        )}
        {payments.methods.map(({ method, total }) => (
          <Metric
            key={method}
            label={t(methodKey(method))}
            value={total}
            meaning="inflow"
          />
        ))}
      </>
    ),
    debt: (
      <>
        <Metric
          label={t("outstanding")}
          value={debt.outstanding}
          meaning="receivable"
          link={debtors}
          primary
        />
        <Metric label={t("newDebt")} value={debt.new} meaning="receivable" />
        <Metric
          label={t("customerCount")}
          value={debt.customers}
          link={debtors}
        />
        <Metric
          label={t("partiallyPaid")}
          value={debt.partial}
          link={{ to: "/sales", search: { paymentStatus: "PARTIALLY_PAID" } }}
        />
        <Metric
          label={t("unpaid")}
          value={debt.unpaid}
          link={{ to: "/sales", search: { paymentStatus: "UNPAID" } }}
        />
      </>
    ),
    intake: (
      <>
        <Metric
          label={t("intakeCount")}
          value={intake.count}
          link={received}
          primary
          comparison={comparison?.intake ?? null}
        />
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
        <Metric
          label={t("stockCount")}
          value={inventory.count}
          link={stock}
          primary
        />
        <Metric
          label={t("stockWeight")}
          value={formatWeight(inventory.weight, locale)}
        />
        <Metric label={t("marketValue")} value={inventory.marketValue} />
      </>
    ),
  };
  return <dl className="divide-y">{series[kind]}</dl>;
}

export function OwnerMetric({
  data,
  comparison,
}: {
  data: DashboardOwnerSummary["grossProfit"];
  comparison?: DashboardMoneyComparison[];
}) {
  return (
    <>
      <p className="text-xl font-semibold tabular-nums">
        <Values value={data} meaning={comparison ? "profit" : "neutral"} />
      </p>
      {comparison && (
        <div className="text-xs">
          <DailyComparison comparison={comparison} />
        </div>
      )}
    </>
  );
}

export const chartWidgets = [
  "salesTrend",
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
  salesMetric,
  changeSalesMetric,
}: {
  data: DashboardCharts;
  kind: ChartWidgetId;
  salesMetric: "sales" | "count";
  changeSalesMetric: (metric: "sales" | "count") => void;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const [dimension, setDimension] = useState("purity");
  if (kind === "salesTrend" || kind === "paymentTrend")
    return (
      <WeeklyChart
        days={data.days}
        kind={kind === "salesTrend" ? salesMetric : "payments"}
        changeMetric={kind === "salesTrend" ? changeSalesMetric : undefined}
      />
    );

  const localizeCategory = ({ label, categoryCode }: DashboardCount) =>
    categoryLabel(
      { name: label, code: categoryCode ?? null },
      i18n.resolvedLanguage,
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
      <DistributionChart
        rows={distributions[kind]}
        formatLabel={
          kind === "categories" ||
          (kind === "distribution" && dimension === "category")
            ? localizeCategory
            : undefined
        }
      />
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
  const { t, i18n } = useTranslation(["dashboard", "auth"]);
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
              <span className="text-right text-sm wrap-anywhere tabular-nums text-warning-foreground">
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
            <p className="pb-1 text-xs wrap-anywhere text-muted-foreground">
              {t(item.kind)} ·{" "}
              <time dateTime={item.at}>
                {formatMarketTime(item.at, locale)}
              </time>
              {" · "}
              {item.actorName ?? t("unknownActor", { ns: "auth" })}
            </p>
          </div>
          {item.value && (
            <span className="text-right text-sm tabular-nums">
              <Values
                value={item.value}
                meaning={item.kind === "repayment" ? "inflow" : "neutral"}
              />
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
      <Link
        to="/products"
        search={{ status: "IN_STOCK", agedDays: days }}
        className={`${activityLink} gap-1`}
      >
        {t("agedCount", { count: data.count, days })}
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
      </Link>
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
