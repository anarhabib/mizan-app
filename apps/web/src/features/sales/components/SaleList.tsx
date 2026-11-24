import { CursorPagination } from "@/shared/ui/CursorPagination";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { categoryLabel } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductThumbnail } from "@/features/products";
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
import { SalePaymentStatusBadge } from "./SalePaymentStatusBadge";
import { SalesOverview } from "./SalesOverview";

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
  const { t, i18n } = useTranslation("sales");
  const { t: productLabel } = useTranslation("products");
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
  const { date, dateFrom, dateTo, ...otherFilters } = active;
  const period = {
    dateFrom: dateFrom ?? (dateTo ? undefined : date),
    dateTo: dateTo ?? (dateFrom ? undefined : date),
  };
  const invalidRange = Boolean(
    period.dateFrom && period.dateTo && period.dateFrom > period.dateTo,
  );
  const requestFilters = { ...otherFilters, ...period, q: q || undefined };
  const pagination = useCursorPagination(JSON.stringify(requestFilters));
  const query = useQuery(
    saleListQuery(scope, requestFilters, pagination.request, !invalidRange),
  );
  const rows = query.data?.items ?? [];
  const filtered = Boolean(
    q ||
    period.dateFrom ||
    period.dateTo ||
    active.paymentDate ||
    active.paymentStatus,
  );
  const clearFilters = () => {
    setSearch("");
    setQuery("");
    changeFilters({});
  };

  return (
    <div className="space-y-4">
      <SalesOverview
        scope={scope}
        period={period}
        invalidRange={invalidRange}
        showPeriodSales={() => {
          setSearch("");
          setQuery("");
          changeFilters(period);
        }}
      />
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
            maxLength={160}
            placeholder={t("searchHint")}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-11 lg:min-h-9"
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <div className="grid min-w-0 grid-cols-2 gap-2">
            {(["dateFrom", "dateTo"] as const).map((bound) => (
              <div key={bound} className="grid min-w-0 gap-2">
                <Label htmlFor={`sale-${bound}`}>{t(bound)}</Label>
                <Input
                  id={`sale-${bound}`}
                  type="date"
                  value={period[bound] ?? ""}
                  aria-invalid={invalidRange}
                  aria-describedby={
                    invalidRange ? "sales-range-error" : undefined
                  }
                  onChange={(event) =>
                    changeFilters({
                      ...otherFilters,
                      ...period,
                      [bound]: event.target.value || undefined,
                    })
                  }
                  className="min-h-11 lg:min-h-9"
                />
              </div>
            ))}
          </div>
          {invalidRange && (
            <p
              id="sales-range-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {t("invalidDateRange")}
            </p>
          )}
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
            onClick={clearFilters}
          >
            {t("clearFilters")}
          </Button>
        )}
      </div>
      <section
        id="sales-results"
        hidden={invalidRange}
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
          <div
            inert={query.isPlaceholderData}
            className="hidden rounded-lg border border-border bg-card lg:block"
          >
            <Table aria-label={t("title")}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">
                    {productLabel("fields.code")}
                  </TableHead>
                  <TableHead scope="col">
                    {productLabel("formFields.name")}
                  </TableHead>
                  <TableHead scope="col">
                    {productLabel("fields.category")}
                  </TableHead>
                  <TableHead scope="col">{t("date")}</TableHead>
                  <TableHead scope="col" className="text-right">
                    {t("fields.saleTotal")}
                  </TableHead>
                  <TableHead scope="col">{t("paymentStatusLabel")}</TableHead>
                  <TableHead scope="col" className="w-12">
                    <span className="sr-only">{t("detail")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="w-32 text-xs wrap-anywhere whitespace-normal text-muted-foreground">
                      {sale.product.code}
                    </TableCell>
                    <TableCell className="w-full font-medium wrap-anywhere whitespace-normal">
                      <div className="flex items-center gap-2">
                        <ProductThumbnail src={sale.thumbnailUrl} />
                        <span>
                          {sale.product.name}
                          {sale.itemCount > 1 && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {t("extraProducts", {
                                count: sale.itemCount - 1,
                              })}
                            </span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-24 max-w-40 wrap-anywhere whitespace-normal text-muted-foreground">
                      {categoryLabel(
                        {
                          code: sale.product.categoryCode ?? null,
                          name: sale.product.category,
                        },
                        i18n.resolvedLanguage,
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <SaleDate value={sale.createdAt} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText
                        value={{
                          amount: sale.saleAmount,
                          currency: sale.currency,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <SalePaymentStatusBadge status={sale.paymentStatus} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label={`${t("detail")} · ${sale.product.code}`}
                        onClick={(event) =>
                          inspect(sale.id, event.currentTarget)
                        }
                      >
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {rows.length > 0 && (
          <ul
            inert={query.isPlaceholderData}
            className="divide-y overflow-hidden rounded-lg border border-border bg-card lg:hidden"
          >
            {rows.map((sale) => (
              <li key={sale.id}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(event) => inspect(sale.id, event.currentTarget)}
                  className="grid h-auto min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-none px-3 py-3 text-left text-sm font-normal whitespace-normal outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="grid min-w-0 gap-2">
                    <span className="wrap-anywhere text-xs text-muted-foreground">
                      {sale.product.code}
                    </span>
                    <span className="max-w-prose font-medium wrap-anywhere">
                      {sale.product.name}
                      {sale.itemCount > 1 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {t("extraProducts", { count: sale.itemCount - 1 })}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-right wrap-anywhere">
                    <MoneyText
                      value={{
                        amount: sale.saleAmount,
                        currency: sale.currency,
                      }}
                    />
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <SaleDate value={sale.createdAt} />
                    <SalePaymentStatusBadge status={sale.paymentStatus} />
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 justify-self-end text-muted-foreground"
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
            retry={() => void query.refetch()}
          />
        )}
        <CursorPagination
          pagination={pagination}
          nextCursor={query.data?.nextCursor}
          pending={query.isPending || query.isPlaceholderData}
          label={t("title")}
        />
      </section>
    </div>
  );
}
