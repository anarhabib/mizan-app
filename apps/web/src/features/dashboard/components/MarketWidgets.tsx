import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  goldPriceKinds,
  marketPeriods,
  officialRateCurrencies,
  type GoldPriceKind,
  type MarketMovement,
  type MarketPeriod,
  type MarketSeries,
} from "@mizan/contracts";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  exchangeHistoryQuery,
  exchangeRatesQuery,
} from "@/features/exchange-rates";
import {
  goldCurrentRatesQuery,
  goldMarketChartQuery,
  goldMarketQuery,
  goldStoreChartQuery,
} from "@/features/gold-prices";
import { formatDecimal, formatMoney } from "@/shared/lib/format";
import type { DashboardScope } from "../api/queries";
import type { ChartUnit, Preferences } from "../preferences";
import { DashboardCard, QueryContent } from "./DashboardCard";
import { formatMarketTime, PriceChart } from "./DashboardCharts";

const control = "min-h-10 lg:min-h-8";
const directions = {
  up: {
    icon: ArrowUpRight,
    label: "directionUp",
    className: "text-success-foreground",
  },
  down: {
    icon: ArrowDownRight,
    label: "directionDown",
    className: "text-danger-foreground",
  },
  flat: {
    icon: Minus,
    label: "directionFlat",
    className: "text-muted-foreground",
  },
} as const;

function Change({
  movement,
  format,
}: {
  movement: MarketMovement;
  format: (amount: string) => string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const { icon: Icon, label, className } = directions[movement.direction];
  const sign = movement.direction === "up" ? "+" : "";
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1 text-xs tabular-nums ${className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{t(label)}</span>
      {sign}
      {format(movement.absolute)} ({sign}
      {formatDecimal(movement.percent, i18n.resolvedLanguage ?? "az")}%)
    </span>
  );
}

export function PeriodSelect({
  period,
  onChange,
}: {
  period: MarketPeriod;
  onChange: (value: MarketPeriod) => void;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <Select
      value={period}
      onValueChange={(value) => onChange(value as MarketPeriod)}
    >
      <SelectTrigger className={control} aria-label={t("period")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {marketPeriods.map((value) => (
          <SelectItem key={value} value={value}>
            {t(`periods.${value}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PuritySelect({
  purities,
  purity,
  onChange,
  automatic = false,
}: {
  purities: number[];
  purity: number | null;
  onChange: (value: number | null) => void;
  automatic?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <Select
      value={
        purity === null || !purities.includes(purity) ? "auto" : String(purity)
      }
      disabled={!purities.length}
      onValueChange={(value) =>
        onChange(value === "auto" ? null : Number(value))
      }
    >
      <SelectTrigger className={control} aria-label={t("purity")}>
        <SelectValue placeholder={t("purity")} />
      </SelectTrigger>
      <SelectContent>
        {automatic && <SelectItem value="auto">{t("autoPurity")}</SelectItem>}
        {purities.map((value) => (
          <SelectItem key={value} value={String(value)}>
            {value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function UnitSelect({
  unit,
  onChange,
}: {
  unit: ChartUnit;
  onChange: (value: ChartUnit) => void;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <Select
      value={unit}
      onValueChange={(value) => onChange(value as ChartUnit)}
    >
      <SelectTrigger className={control} aria-label={t("unit")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="usd">{t("usd")}</SelectItem>
        <SelectItem value="azn">{t("azn")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function MarketSeriesChart({
  series,
  unit,
  period,
}: {
  series: MarketSeries;
  unit: ChartUnit;
  period: MarketPeriod;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const currency = unit === "usd" ? "USD" : "AZN";
  const format = (amount: string) =>
    formatMoney({ amount, currency }, i18n.resolvedLanguage);
  return (
    <>
      <div className="flex min-h-5 flex-wrap justify-between gap-2 text-xs">
        {series.movement && (
          <Change movement={series.movement} format={format} />
        )}
        {series.high !== null && series.low !== null && (
          <>
            <p
              className="flex flex-wrap gap-x-3 text-muted-foreground tabular-nums"
              aria-hidden="true"
            >
              <span>
                {t("high")} {format(series.high)}
              </span>
              <span>
                {t("low")} {format(series.low)}
              </span>
            </p>
            <p className="sr-only">
              {t("chartSummary", {
                low: format(series.low),
                high: format(series.high),
              })}
            </p>
          </>
        )}
      </div>
      <PriceChart
        points={series.points}
        format={format}
        label={t(unit)}
        hours={period === "24h"}
      />
    </>
  );
}

export function GoldWidget({
  scope,
  preferences,
}: {
  scope: DashboardScope;
  preferences: Preferences;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const [unit, setUnit] = useState(preferences.unit);
  const [period, setPeriod] = useState(preferences.period);
  const [selected, setSelected] = useState(preferences.purity);
  const market = useQuery(goldMarketQuery(scope));
  const purities = market.data?.references.map(({ purity }) => purity) ?? [];
  const purity =
    selected !== null && purities.includes(selected) ? selected : purities[0];
  const history = useQuery({
    ...goldMarketChartQuery(
      scope,
      period,
      purity,
      market.data?.quote?.id ?? null,
    ),
    enabled: market.data !== undefined,
    placeholderData: (previous, query) =>
      query?.queryKey[4] === period && query.queryKey[5] === purity
        ? previous
        : undefined,
  });
  const locale = i18n.resolvedLanguage ?? "az";
  return (
    <DashboardCard title={t("widgets.gold")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-xs font-semibold tracking-wide">
          XAU/USD
        </span>
        {market.data?.stale && <Badge variant="warning">{t("stale")}</Badge>}
      </div>
      <QueryContent query={market}>
        {({ quote }) =>
          quote ? (
            <>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("spot")}</dt>
                  <dd className="text-lg font-semibold wrap-anywhere tabular-nums">
                    {formatMoney(
                      { amount: quote.usdPerTroyOunce, currency: "USD" },
                      locale,
                    )}
                  </dd>
                  <span className="text-xs text-muted-foreground">
                    {t("usd")}
                  </span>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("pure")}</dt>
                  <dd className="text-lg font-semibold wrap-anywhere tabular-nums">
                    {formatMoney(quote.pricePerGram, locale)}
                  </dd>
                  <span className="text-xs text-muted-foreground">
                    {t("azn")}
                  </span>
                </div>
              </dl>
              <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span>
                  {quote.source === "GOLD_API" ? "Gold API" : quote.source}
                </span>
                <time dateTime={quote.effectiveAt}>
                  {formatMarketTime(quote.effectiveAt, locale, true, true)}
                </time>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">{t("unavailable")}</p>
          )
        }
      </QueryContent>
      <div className="flex flex-wrap gap-2">
        <PeriodSelect period={period} onChange={setPeriod} />
        <UnitSelect unit={unit} onChange={setUnit} />
        {unit === "azn" && (
          <PuritySelect
            purities={purities}
            purity={purity ?? null}
            onChange={setSelected}
          />
        )}
      </div>
      {market.data && (
        <QueryContent query={history}>
          {(data) => (
            <MarketSeriesChart
              series={data[unit]}
              unit={unit}
              period={period}
            />
          )}
        </QueryContent>
      )}
    </DashboardCard>
  );
}

export function ExchangeWidget({ scope }: { scope: DashboardScope }) {
  const { t, i18n } = useTranslation("dashboard");
  const current = useQuery(exchangeRatesQuery(scope));
  const date = current.data?.snapshot?.effectiveDate;
  const history = useQuery({
    ...exchangeHistoryQuery(scope, date),
    enabled: !!date,
  });
  const locale = i18n.resolvedLanguage ?? "az";
  const names = new Intl.DisplayNames(locale, { type: "currency" });
  const format = (amount: string) =>
    t("fxRate", { rate: formatDecimal(amount, locale) });
  return (
    <DashboardCard title={t("widgets.exchange")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("currencySource")}</p>
        {current.data?.stale && <Badge variant="warning">{t("stale")}</Badge>}
      </div>
      <QueryContent query={current}>
        {({ snapshot }) =>
          snapshot ? (
            <>
              <time
                className="text-xs text-muted-foreground"
                dateTime={snapshot.effectiveDate}
              >
                {formatMarketTime(snapshot.effectiveDate, locale, false, true)}
              </time>
              <ul className="divide-y">
                {officialRateCurrencies.map((currency) => {
                  const series =
                    history.data?.effectiveDate === snapshot.effectiveDate
                      ? history.data.currencies[currency]
                      : undefined;
                  return (
                    <li
                      key={currency}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,0.5fr)_auto] items-center gap-2 py-3"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold">{currency}/AZN</span>
                        <p className="text-xs text-muted-foreground wrap-anywhere">
                          {names.of(currency)}
                        </p>
                      </div>
                      {series && (
                        <PriceChart
                          points={series.points}
                          format={format}
                          label={currency}
                          compact
                          color={
                            series.movement?.direction === "down"
                              ? "var(--danger-foreground)"
                              : series.movement?.direction === "flat"
                                ? "var(--muted-foreground)"
                                : undefined
                          }
                        />
                      )}
                      <div className="col-start-3 text-right">
                        <p className="font-semibold tabular-nums">
                          {format(snapshot.rates[currency])}
                        </p>
                        {series?.movement && (
                          <Change movement={series.movement} format={format} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <QueryContent query={history}>
                {(data) => (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      data.effectiveDate === date &&
                        data.currencies.USD.movement
                        ? "fxComparison"
                        : "fxNoComparison",
                    )}
                  </p>
                )}
              </QueryContent>
            </>
          ) : (
            <p className="text-muted-foreground">{t("unavailable")}</p>
          )
        }
      </QueryContent>
    </DashboardCard>
  );
}

export function StoreRatesWidget({
  scope,
  preferences,
}: {
  scope: DashboardScope;
  preferences: Preferences;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const current = useQuery(goldCurrentRatesQuery(scope));
  const [kind, setKind] = useState<GoldPriceKind | "reference">("RETAIL_SELL");
  const [selected, setSelected] = useState(preferences.purity);
  const [period, setPeriod] = useState(preferences.period);
  const purities = current.data?.rates.map(({ purity }) => purity) ?? [];
  const purity =
    selected !== null && purities.includes(selected) ? selected : purities[0];
  const history = useQuery({
    ...goldStoreChartQuery(
      scope,
      period,
      purity,
      kind === "reference" ? "RETAIL_SELL" : kind,
    ),
    enabled: purity !== undefined && kind !== "reference",
  });
  const referenceHistory = useQuery({
    ...goldMarketChartQuery(
      scope,
      period,
      purity,
      current.data?.quoteId ?? null,
    ),
    enabled: purity !== undefined && kind === "reference",
    select: (series) => series.azn,
  });
  const display = (price: { amount: string; currency: string } | null) =>
    price ? formatMoney(price, i18n.resolvedLanguage) : "—";
  return (
    <DashboardCard title={t("widgets.storeRates")}>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={kind}
          onValueChange={(value) =>
            setKind(value as GoldPriceKind | "reference")
          }
        >
          <SelectTrigger aria-label={t("rateType")} className={control}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="reference">{t("reference")}</SelectItem>
            {goldPriceKinds.map((value) => (
              <SelectItem key={value} value={value}>
                {t(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PuritySelect
          purities={purities}
          purity={purity ?? null}
          onChange={setSelected}
        />
        <PeriodSelect period={period} onChange={setPeriod} />
      </div>
      <QueryContent query={current}>
        {({ rates, stale }) => (
          <>
            {stale && <Badge variant="warning">{t("stale")}</Badge>}
            <div className="max-h-48 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-card text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">{t("purityShort")}</th>
                    <th className="py-2 text-right font-medium">
                      {t("reference")}
                    </th>
                    {kind !== "reference" && (
                      <th className="py-2 text-right font-medium">{t(kind)}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rates.map((rate) => (
                    <tr key={rate.purity}>
                      <th scope="row" className="py-2">
                        {rate.purity}
                      </th>
                      <td className="py-2 text-right tabular-nums">
                        {display(rate.reference)}
                      </td>
                      {kind !== "reference" && (
                        <td className="py-2 text-right tabular-nums">
                          {display(rate.commercial[kind])}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {purity !== undefined ? (
              <QueryContent
                query={kind === "reference" ? referenceHistory : history}
              >
                {(series) => (
                  <MarketSeriesChart
                    series={series}
                    unit="azn"
                    period={period}
                  />
                )}
              </QueryContent>
            ) : (
              <p className="text-muted-foreground">{t("empty")}</p>
            )}
          </>
        )}
      </QueryContent>
    </DashboardCard>
  );
}
