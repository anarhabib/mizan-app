import { PendingButton } from "@/shared/ui/PendingButton";
import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { MoneyText } from "@/shared/ui/MoneyText";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import {
  saleListQuery,
  type SaleFilters,
  type SaleScope,
} from "../api/queries";
import { SaleDate } from "./SaleResult";

export function SaleList({
  scope,
  inspect,
  filters = {},
  setFilters,
}: {
  scope: SaleScope;
  inspect: (id: string, opener: HTMLElement) => void;
  filters?: Omit<SaleFilters, "q">;
  setFilters?: (filters: Omit<SaleFilters, "q">) => void;
}) {
  const { t } = useTranslation("sales");
  const [search, setSearch] = useState("");
  const [q, setQuery] = useState("");
  const [localFilters, setLocalFilters] = useState<Omit<SaleFilters, "q">>({});
  const active = setFilters ? filters : localFilters;
  const changeFilters = setFilters ?? setLocalFilters;
  useEffect(() => {
    const timer = window.setTimeout(
      () => setQuery(search.trim().replaceAll("\0", "")),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = useInfiniteQuery(
    saleListQuery(scope, { ...active, q: q || undefined }),
  );
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = Boolean(
    q || active.date || active.paymentDate || active.paymentStatus,
  );

  return (
    <div className="space-y-4">
      <div
        role="search"
        className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:flex sm:flex-wrap sm:items-end"
      >
        <div className="grid min-w-0 gap-2 sm:w-72">
          <Label htmlFor="sale-search">{t("search")}</Label>
          <Input
            id="sale-search"
            type="search"
            value={search}
            autoComplete="off"
            placeholder={t("searchHint")}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-11 lg:min-h-9"
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="sale-date">{t("date")}</Label>
          <Input
            id="sale-date"
            type="date"
            value={active.date ?? ""}
            onChange={(event) =>
              changeFilters({
                ...active,
                date: event.target.value || undefined,
              })
            }
            className="min-h-11 lg:min-h-9"
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="payment-status">{t("paymentStatusLabel")}</Label>
          <OptionSelect
            id="payment-status"
            value={active.paymentStatus ?? "all"}
            options={[
              { value: "all", label: t("allStatuses") },
              ...(["PAID", "PARTIALLY_PAID", "UNPAID"] as const).map(
                (value) => ({
                  value,
                  label: t(`paymentStatus.${value}`),
                }),
              ),
            ]}
            onChange={(value) =>
              changeFilters({
                ...active,
                paymentStatus:
                  value === "PAID" ||
                  value === "PARTIALLY_PAID" ||
                  value === "UNPAID"
                    ? value
                    : undefined,
              })
            }
          />
        </div>
        {active.paymentDate && (
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="payment-date">{t("paymentDate")}</Label>
            <Input
              id="payment-date"
              type="date"
              value={active.paymentDate}
              onChange={(event) =>
                changeFilters({
                  ...active,
                  paymentDate: event.target.value || undefined,
                })
              }
              className="min-h-11 lg:min-h-9"
            />
          </div>
        )}
        {(search || filtered) && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 justify-self-start lg:min-h-9"
            onClick={() => {
              setSearch("");
              setQuery("");
              changeFilters({});
            }}
          >
            {t("clearFilters")}
          </Button>
        )}
      </div>
      <section
        aria-label={t("title")}
        aria-busy={query.isFetching}
        className="space-y-3"
      >
        {query.isPending && <ListSkeleton />}
        {!rows.length &&
          !query.isPending &&
          !query.isError &&
          !query.isPlaceholderData && (
            <EmptyState
              title={t(filtered ? "noResults" : "empty")}
              description={t(filtered ? "noResultsHint" : "description")}
            />
          )}
        {rows.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-lg border border-border bg-card">
            {rows.map((sale) => (
              <li key={sale.id}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(event) => inspect(sale.id, event.currentTarget)}
                  className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 text-left text-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-4 lg:py-2 h-auto justify-start rounded-none font-normal whitespace-normal"
                >
                  <span className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center">
                    <span className="wrap-anywhere text-xs text-muted-foreground">
                      {sale.product.code}
                    </span>
                    <span className="font-medium wrap-anywhere">
                      {sale.product.name}
                      {sale.itemCount > 1 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {t("extraProducts", { count: sale.itemCount - 1 })}
                        </span>
                      )}
                      {sale.paymentStatus !== "PAID" && (
                        <span className="block text-xs font-normal text-warning-foreground">
                          {t(`paymentStatus.${sale.paymentStatus}`)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-right wrap-anywhere lg:order-3">
                    <MoneyText
                      value={{
                        amount: sale.saleAmount,
                        currency: sale.currency,
                      }}
                    />
                  </span>
                  <span className="text-xs text-muted-foreground lg:order-2">
                    <SaleDate value={sale.createdAt} />
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 justify-self-end text-muted-foreground lg:order-4"
                  />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {query.error && (
          <ErrorState
            error={query.error}
            pending={query.isFetching}
            retry={() =>
              void (query.isFetchNextPageError
                ? query.fetchNextPage()
                : query.refetch())
            }
          />
        )}
        {query.hasNextPage && !query.isFetchNextPageError && (
          <PendingButton
            pending={query.isFetchingNextPage}
            variant="outline"
            disabled={query.isFetching || query.isPlaceholderData}
            className="min-h-11 lg:min-h-9"
            onClick={() => void query.fetchNextPage()}
          >
            {t(query.isFetchingNextPage ? "loadingMore" : "loadMore")}
          </PendingButton>
        )}
      </section>
    </div>
  );
}
