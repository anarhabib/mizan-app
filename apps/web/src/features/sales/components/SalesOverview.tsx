import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { MoneyText } from "@/shared/ui/MoneyText";
import {
  saleOverviewQuery,
  type SalePeriod,
  type SaleScope,
} from "../api/queries";

export function SalesOverview({
  scope,
  period,
  invalidRange,
  showPeriodSales,
}: {
  scope: SaleScope;
  period: SalePeriod;
  invalidRange: boolean;
  showPeriodSales: () => void;
}) {
  const { t, i18n } = useTranslation("sales");
  const heading = useId();
  const query = useQuery(saleOverviewQuery(scope, period, !invalidRange));
  const number = new Intl.NumberFormat(i18n.resolvedLanguage);
  const data = query.data;
  const { dateFrom, dateTo } = period;
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const from = dateFrom && date.format(new Date(dateFrom));
  const to = dateTo && date.format(new Date(dateTo));

  return (
    <section
      aria-labelledby={heading}
      className="grid gap-2 rounded-lg border bg-card p-3"
    >
      <h2 id={heading} className="font-medium">
        {t("overview.title")}
      </h2>
      <p className="text-xs text-muted-foreground">
        {from && to
          ? from === to
            ? from
            : t("overview.periodRange", { from, to })
          : from
            ? t("overview.periodFrom", { from })
            : to
              ? t("overview.periodTo", { to })
              : t("overview.periodAll")}
      </p>
      {!invalidRange && query.isPending && <ListSkeleton rows={1} />}
      {!invalidRange && query.isError && (
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
          pending={query.isFetching}
        />
      )}
      {!invalidRange && data && (
        <dl className="grid max-w-272 grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-x-3 gap-y-2">
          <div className="relative min-w-0 rounded-md bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">
              <a
                href="#sales-results"
                onClick={(event) => {
                  if (
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey
                  )
                    showPeriodSales();
                }}
                className="underline-offset-2 outline-none after:absolute after:inset-0 after:rounded-md hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {t("overview.completedSales")}
              </a>
            </dt>
            <dd className="text-base font-semibold tabular-nums">
              {number.format(data.completedSales)}
            </dd>
          </div>
          {(
            [
              "salesAmount",
              "returnedValue",
              "netSales",
              "amountReceived",
              "refunds",
              "netReceived",
              "outstandingDebt",
            ] as const
          ).map(
            (metric) =>
              data[metric] && (
                <div
                  key={metric}
                  className="min-w-0 rounded-md bg-muted/50 p-2"
                >
                  <dt className="text-xs text-muted-foreground">
                    {t(
                      metric === "salesAmount" && data.returnedValue
                        ? "overview.grossSales"
                        : `overview.${metric}`,
                    )}
                  </dt>
                  {data[metric].length ? (
                    data[metric].map((value) => (
                      <dd
                        key={value.currency}
                        className="text-base font-semibold wrap-anywhere"
                      >
                        <MoneyText value={value} />
                      </dd>
                    ))
                  ) : (
                    <dd className="text-base font-semibold">
                      {t("overview.noAmounts")}
                    </dd>
                  )}
                </div>
              ),
          )}
          <div className="min-w-0 rounded-md bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">
              {t("overview.productsSold")}
            </dt>
            <dd className="text-base font-semibold tabular-nums">
              {number.format(data.productsSold)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
