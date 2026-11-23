import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import type {
  DashboardCharts,
  DashboardCount,
  MarketPoint,
} from "@mizan/contracts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatDecimal, formatMoney } from "@/shared/lib/format";
import { useId, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function formatMarketTime(
  value: string | number,
  locale: string,
  time = true,
  full = false,
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "az" ? "az-Latn" : locale, {
    timeZone: "Asia/Baku",
    day: "2-digit",
    month: "2-digit",
    ...(full && { year: "numeric" }),
    ...(time && { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  }).format(date);
}

// Recharts needs numeric coordinates. Formatted values come from the decimal strings.
export function PriceChart({
  points,
  format,
  label,
  compact = false,
  hours = false,
  color,
}: {
  points: MarketPoint[];
  format: (value: string) => string;
  label: string;
  compact?: boolean;
  hours?: boolean;
  color?: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const data = points
    .map(({ at, value }) => ({
      at: Date.parse(at),
      raw: value,
      y: value === null ? null : +value,
    }))
    .filter(({ at }) => Number.isFinite(at));
  const valid = data.filter(({ raw }) => raw !== null).length;
  if (valid < 2) {
    return compact ? (
      <span className="text-xs text-muted-foreground">—</span>
    ) : (
      <p className="grid h-44 place-items-center px-3 py-6 text-center text-sm text-muted-foreground lg:h-48">
        {t(valid ? "oneObservation" : "noObservations")}
      </p>
    );
  }
  const locale = i18n.resolvedLanguage ?? "az";
  const axis = new Intl.NumberFormat(locale, { maximumSignificantDigits: 7 });
  const axisShowsTime = hours || data.at(-1)!.at - data[0].at < 2 * 86_400_000;
  const tick = { fill: "var(--muted-foreground)" };
  return (
    <ChartContainer
      config={{
        y: color
          ? { label, color }
          : {
              label,
              theme: { light: "var(--chart-4)", dark: "var(--chart-3)" },
            },
      }}
      initialDimension={
        compact ? { width: 100, height: 38 } : { width: 320, height: 192 }
      }
      className={compact ? "h-9 w-full max-w-24" : "h-44 w-full lg:h-48"}
    >
      <LineChart
        data={data}
        accessibilityLayer={!compact}
        margin={
          compact
            ? { top: 3, right: 2, bottom: 3, left: 2 }
            : { top: 8, right: 12, bottom: 0, left: 0 }
        }
      >
        {!compact && <CartesianGrid vertical={false} />}
        <XAxis
          dataKey="at"
          hide={compact}
          type="number"
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickCount={4}
          tick={tick}
          tickFormatter={(value: number) =>
            formatMarketTime(value, locale, axisShowsTime)
          }
        />
        <YAxis
          hide={compact}
          domain={["auto", "auto"]}
          tickLine={false}
          axisLine={false}
          width={50}
          tick={tick}
          tickFormatter={(value: number) => axis.format(value)}
        />
        {!compact && (
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) =>
                  typeof value === "number"
                    ? formatMarketTime(value, locale)
                    : null
                }
                formatter={(_value, _name, item) =>
                  item.payload.raw === null ? null : (
                    <span className="tabular-nums">
                      {format(item.payload.raw)}
                    </span>
                  )
                }
              />
            }
          />
        )}
        <Line
          dataKey="y"
          type="linear"
          stroke="var(--color-y)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function DistributionChart({ rows }: { rows: DashboardCount[] }) {
  const { t, i18n } = useTranslation("dashboard");
  if (!rows.length || rows.every(({ count }) => count === 0))
    return <p className="text-muted-foreground">{t("empty")}</p>;
  const max = Math.max(...rows.map(({ count }) => count), 1);
  return (
    <ul
      className="max-h-56 space-y-2 overflow-y-auto focus-visible:ring-2 focus-visible:ring-ring"
      tabIndex={0}
      aria-label={t("distributionList")}
    >
      {rows.map(({ label, count }) => (
        <li key={label} className="grid gap-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="wrap-anywhere">{label}</span>
            <span className="tabular-nums">
              {count.toLocaleString(i18n.resolvedLanguage)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-chart-4"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WeeklyChart({
  days,
  kind,
  changeMetric,
}: {
  days: DashboardCharts["days"];
  kind: "count" | "sales" | "payments";
  changeMetric?: (kind: "count" | "sales") => void;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const locale = i18n.resolvedLanguage ?? "az";
  const description = useId();
  const metricLabel = t(
    kind === "count"
      ? "salesCountMetric"
      : kind === "sales"
        ? "salesAmountMetric"
        : "received",
  );
  const currencies =
    kind === "count"
      ? []
      : [
          ...new Set(
            days.flatMap((day) => day[kind].map(({ currency }) => currency)),
          ),
        ];
  const [selected, setSelected] = useState<string>();
  const currency =
    selected && currencies.includes(selected) ? selected : currencies[0];
  const data = weeklyChartData(days, kind, currency);
  const empty =
    kind === "count" ? days.every(({ count }) => count === 0) : !currency;
  const display = (value: string) =>
    currency
      ? formatMoney({ amount: value, currency }, locale)
      : formatDecimal(value, locale);
  const today = data.at(-1);
  const axis = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: kind === "count" ? 0 : 1,
  });
  const tick = { fill: "var(--muted-foreground)" };
  return (
    <figure
      className="space-y-2"
      aria-label={metricLabel}
      aria-describedby={description}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption id={description} className="text-xs text-muted-foreground">
          {t("lastSeven")}
          {currency && ` · ${currency}`}
          {today && !empty && (
            <span className="block font-medium tabular-nums text-foreground">
              {t("chartToday", { value: display(today.raw) })}
            </span>
          )}
        </figcaption>
        <div className="flex flex-wrap gap-2">
          {changeMetric && (
            <Select
              value={kind}
              onValueChange={(value) => {
                if (value === "sales" || value === "count") changeMetric(value);
              }}
            >
              <SelectTrigger
                aria-label={t("salesMetric")}
                className="min-h-11 lg:min-h-8"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">{t("salesAmountMetric")}</SelectItem>
                <SelectItem value="count">{t("salesCountMetric")}</SelectItem>
              </SelectContent>
            </Select>
          )}
          {currencies.length > 1 && currency && (
            <Select value={currency} onValueChange={setSelected}>
              <SelectTrigger
                aria-label={t("unit")}
                className="min-h-11 lg:min-h-8"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      {empty ? (
        <p className="grid h-44 place-items-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ChartContainer
          config={{
            y: {
              label: metricLabel,
              theme: { light: "var(--chart-4)", dark: "var(--chart-3)" },
            },
          }}
          className="h-44 w-full"
        >
          <BarChart
            data={data}
            accessibilityLayer
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(value: string) =>
                formatMarketTime(value, locale, false)
              }
              tickLine={false}
              axisLine={false}
              tick={tick}
            />
            <YAxis
              allowDecimals={kind !== "count"}
              width={48}
              tickLine={false}
              axisLine={false}
              tick={tick}
              tickFormatter={(value: number) => axis.format(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    typeof value === "string"
                      ? formatMarketTime(value, locale, false)
                      : null
                  }
                  formatter={(_value, _name, item) => display(item.payload.raw)}
                />
              }
            />
            <Bar
              dataKey="y"
              fill="var(--color-y)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      )}
      {!empty && (
        <ul className="sr-only">
          {data.map(({ day, raw }) => (
            <li key={day}>
              {formatMarketTime(day, locale, false)} {display(raw)}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export function weeklyChartData(
  days: DashboardCharts["days"],
  kind: "count" | "sales" | "payments",
  currency?: string,
) {
  return days.map((day) => {
    const raw =
      kind === "count"
        ? String(day.count)
        : (day[kind].find((total) => total.currency === currency)?.amount ??
          "0");
    return { day: day.day, raw, y: +raw };
  });
}
