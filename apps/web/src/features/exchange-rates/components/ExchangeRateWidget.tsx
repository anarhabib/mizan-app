import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { Badge } from "@/components/ui/badge";
import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { checkoutCurrencies, officialRateCurrencies } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/shared/ui/MoneyText";
import { useWorkspace } from "@/features/workspace";
import { exchangeRatesQuery, type ExchangeRateScope } from "../api/queries";

export function ExchangeRateWidget({ scope }: { scope: ExchangeRateScope }) {
  const { t, i18n } = useTranslation("products");
  const heading = useId();
  const selected = checkoutCurrencies(useWorkspace().settings);
  const currencies = officialRateCurrencies.filter((code) =>
    selected.includes(code),
  );
  const query = useQuery({
    ...exchangeRatesQuery(scope),
    enabled: currencies.length > 0,
  });
  const snapshot = query.data?.snapshot;
  const date =
    snapshot &&
    new Intl.DateTimeFormat(i18n.resolvedLanguage, {
      dateStyle: "short",
      timeZone: "UTC",
    }).format(new Date(snapshot.effectiveDate));

  if (!currencies.length) return null;
  return (
    <section
      aria-labelledby={heading}
      className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
    >
      <div>
        <h2 id={heading} className="font-medium">
          {t("exchangeRates.title")}
        </h2>
        {snapshot && (
          <p className="text-xs text-muted-foreground">
            {t("exchangeRates.effectiveDate", { date })}
          </p>
        )}
      </div>
      {snapshot ? (
        <>
          <dl className="grid w-full grid-cols-3 gap-3 sm:flex sm:w-auto sm:gap-6">
            {currencies.map((currency) => (
              <div key={currency} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{currency}</dt>
                <dd className="break-words font-medium tabular-nums">
                  <MoneyText
                    value={{
                      amount: snapshot.rates[currency],
                      currency: "AZN",
                    }}
                  />
                </dd>
              </div>
            ))}
          </dl>
          {(query.data?.stale || query.isError) && (
            <Badge role="status" variant="warning">
              {t("exchangeRates.stale")}
            </Badge>
          )}
        </>
      ) : query.isPending ? (
        <div className="min-w-32 flex-1">
          <ListSkeleton rows={1} className="h-8" />
        </div>
      ) : (
        <div
          role="status"
          className="flex items-center gap-2 text-muted-foreground"
        >
          {t("exchangeRates.unavailable")}
          {query.isError && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 lg:min-h-9"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t("exchangeRates.retry")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
