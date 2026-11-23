import { useId, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { MoneyText } from "@/shared/ui/MoneyText";
import { WeightText } from "@/shared/ui/WeightText";
import { productOverviewQuery, type ProductScope } from "../api/queries";

export function InventoryOverview({
  scope,
  owner,
  onSelect,
}: {
  scope: ProductScope;
  owner: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation("products");
  const heading = useId();
  const query = useQuery(productOverviewQuery(scope, owner));
  const number = new Intl.NumberFormat(i18n.resolvedLanguage);
  const data = query.data;
  const choose = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
      onSelect();
  };

  return (
    <section
      aria-labelledby={heading}
      className="mb-4 grid gap-2 rounded-lg border bg-card p-3"
    >
      <h2 id={heading} className="font-medium">
        {t("overview.title")}
      </h2>
      {query.isPending && <ListSkeleton rows={1} />}
      {query.isError && (
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
          pending={query.isFetching}
        />
      )}
      {data && (
        <dl className="grid max-w-[68rem] grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-x-3 gap-y-2">
          {(
            [
              ["available", "IN_STOCK", undefined],
              ["sold", "SOLD", undefined],
              ["soldOnCredit", "SOLD", true],
            ] as const
          ).map(([metric, status, credit]) => (
            <div
              key={metric}
              className="relative min-w-0 rounded-md bg-muted/50 p-2"
            >
              <dt className="text-xs text-muted-foreground">
                <Link
                  to="/products"
                  search={{ status, credit }}
                  hash="product-inventory"
                  onClick={choose}
                  className="underline-offset-2 outline-none after:absolute after:inset-0 after:rounded-md hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  {t(`overview.${metric}`)}
                </Link>
              </dt>
              <dd className="text-base font-semibold tabular-nums">
                {number.format(data[metric])}
              </dd>
            </div>
          ))}
          <div className="min-w-0 rounded-md bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">
              {t("overview.availableWeight")}
            </dt>
            <dd className="text-base font-semibold wrap-anywhere">
              <WeightText value={data.availableWeight} />
            </dd>
          </div>
          {owner && !!data.acquisitionValue?.length && (
            <div className="min-w-0 rounded-md bg-muted/50 p-2">
              <dt className="text-xs text-muted-foreground">
                {t("overview.acquisitionValue")}
              </dt>
              {data.acquisitionValue.map((value) => (
                <dd
                  key={value.currency}
                  className="text-base font-semibold wrap-anywhere"
                >
                  <MoneyText value={value} />
                </dd>
              ))}
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
