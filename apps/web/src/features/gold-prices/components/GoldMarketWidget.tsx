import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/shared/ui/MoneyText";
import { formatDateTime } from "@/shared/lib/format";
import { goldMarketQuery } from "../api/queries";

export function GoldMarketWidget({
  scope,
}: {
  scope: Parameters<typeof goldMarketQuery>[0];
}) {
  const { t, i18n } = useTranslation("gold-prices");
  const heading = useId();
  const query = useQuery(goldMarketQuery(scope));
  const quote = query.data?.quote;

  return (
    <section
      aria-labelledby={heading}
      className="mb-4 grid gap-3 rounded-lg border bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id={heading} className="font-medium">
          {t("marketTitle")}
        </h2>
        {quote && (
          <p className="font-semibold">
            <MoneyText value={quote.pricePerGram} /> {t("perGram")}
          </p>
        )}
      </div>
      {quote ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <p className="text-muted-foreground">
              {t("marketSource", {
                date: formatDateTime(quote.effectiveAt, i18n.resolvedLanguage),
              })}
            </p>
            <p className="text-muted-foreground">
              {t("retrieved", {
                date: formatDateTime(quote.retrievedAt, i18n.resolvedLanguage),
              })}
            </p>
            {(query.data?.stale || query.isError) && (
              <span
                role="status"
                className="rounded-md bg-warning px-2 py-1 text-warning-foreground"
              >
                {t("stale")}
              </span>
            )}
          </div>
          {!!query.data?.references.length && (
            <dl
              aria-label={t("purityReferences")}
              className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 sm:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]"
            >
              {query.data.references.map(
                ({ purity, pricePerGram }) =>
                  pricePerGram && (
                    <div key={purity} className="min-w-0">
                      <dt className="text-xs text-muted-foreground tabular-nums">
                        {purity}
                      </dt>
                      <dd className="font-medium break-words">
                        <MoneyText value={pricePerGram} />
                      </dd>
                    </div>
                  ),
              )}
            </dl>
          )}
        </>
      ) : (
        <p role="status" className="text-muted-foreground">
          {t(query.isPending ? "loading" : "unavailable")}
        </p>
      )}
      {query.isError && (
        <Button
          variant="outline"
          className="min-h-11 justify-self-start lg:min-h-9"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t("retry")}
        </Button>
      )}
    </section>
  );
}
