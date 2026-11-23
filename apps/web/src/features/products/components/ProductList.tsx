import { PendingButton } from "@/shared/ui/PendingButton";
import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import type { ProductStatus } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { PurityText } from "@/shared/ui/PurityText";
import { WeightText } from "@/shared/ui/WeightText";
import {
  productListQuery,
  type ProductFilters as Filters,
  type ProductScope,
} from "../api/queries";
import { ProductFilters } from "./ProductFilters";

export function ProductStatusBadge({
  status,
  hasOutstandingDebt,
}: {
  status: ProductStatus;
  hasOutstandingDebt?: boolean;
}) {
  const { t } = useTranslation("products");
  if (status === "SOLD" && hasOutstandingDebt)
    return <Badge variant="warning">{t("status.SOLD_ON_CREDIT")}</Badge>;
  return (
    <Badge variant={status === "IN_STOCK" ? "success" : "outline"}>
      {t(`status.${status}`)}
    </Badge>
  );
}

export function ProductList({
  scope,
  inspect,
  onlyInStock = false,
  initialStatus = "IN_STOCK",
  dashboardFilters,
  clearDashboardFilters,
}: {
  scope: ProductScope;
  inspect: (id: string, opener: HTMLElement) => void;
  onlyInStock?: boolean;
  initialStatus?: ProductStatus | "all";
  dashboardFilters?: Pick<Filters, "soldOn" | "receivedOn" | "agedDays">;
  clearDashboardFilters?: () => void;
}) {
  const { t } = useTranslation("products");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Omit<Filters, "q">>({
    status: initialStatus === "all" ? undefined : initialStatus,
  });
  const { soldOn, receivedOn, agedDays } = dashboardFilters ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-3 lg:block">
        <ProductSearch onSearch={setSearch} />
        {!onlyInStock && (
          <div className="lg:mt-4">
            <ProductFilters
              scope={scope}
              filters={filters}
              setFilters={setFilters}
            />
          </div>
        )}
      </div>
      {(soldOn || receivedOn || agedDays) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {soldOn && <span>{t("soldOn", { date: soldOn })}</span>}
          {receivedOn && <span>{t("receivedOn", { date: receivedOn })}</span>}
          {agedDays && <span>{t("agedDays", { count: agedDays })}</span>}
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 lg:min-h-9"
            onClick={clearDashboardFilters}
          >
            {t("clearDashboardFilters")}
          </Button>
        </div>
      )}
      <ProductResults
        scope={scope}
        filters={{
          ...filters,
          soldOn,
          receivedOn,
          agedDays,
          ...(onlyInStock && { status: "IN_STOCK" }),
          q: search || undefined,
        }}
        inspect={inspect}
      />
    </div>
  );
}

function ProductSearch({ onSearch }: { onSearch: (value: string) => void }) {
  const { t } = useTranslation("products");
  const [value, setValue] = useState("");
  useEffect(() => {
    if (window.location.hash !== "#product-search") return;
    const frame = requestAnimationFrame(() =>
      document.getElementById("product-search")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(
      () => onSearch(value.trim().replaceAll("\0", "")),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [onSearch, value]);

  return (
    <div role="search" className="grid min-w-0 flex-1 gap-2 lg:max-w-sm">
      <Label htmlFor="product-search">{t("search")}</Label>
      <Input
        id="product-search"
        type="search"
        autoComplete="off"
        maxLength={160}
        value={value}
        placeholder={t("searchHint")}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-11 lg:min-h-9"
      />
    </div>
  );
}

function ProductResults({
  scope,
  filters,
  inspect,
}: {
  scope: ProductScope;
  filters: Filters;
  inspect: (id: string, opener: HTMLElement) => void;
}) {
  const { t } = useTranslation("products");
  const query = useInfiniteQuery(productListQuery(scope, filters));

  if (query.isPending) return <ListSkeleton />;
  if (query.isError && !query.data) {
    return (
      <ErrorState
        error={query.error}
        retry={() => void query.refetch()}
        pending={query.isFetching}
      />
    );
  }
  const products = query.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = Object.values(filters).some((value) => value !== undefined);

  return (
    <section
      aria-label={t("title")}
      aria-busy={query.isFetching}
      className="space-y-3"
    >
      {products.length === 0 && !query.isError && !query.isPlaceholderData && (
        <EmptyState
          title={t(filtered ? "noResults" : "empty")}
          description={t(filtered ? "noResultsHint" : "description")}
        />
      )}
      {products.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border border-border bg-card">
          {products.map((product) => (
            <li key={product.id}>
              <Button
                variant="ghost"
                type="button"
                onClick={(event) => inspect(product.id, event.currentTarget)}
                className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 text-left text-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6rem_auto] lg:gap-4 lg:py-2 h-auto justify-start rounded-none font-normal whitespace-normal"
              >
                <span className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center">
                  <span className="wrap-break-word text-xs text-muted-foreground">
                    {product.code}
                  </span>
                  <span className="wrap-break-word font-medium">
                    {product.name}
                  </span>
                </span>
                <span className="justify-self-end lg:order-3">
                  <ProductStatusBadge
                    status={product.status}
                    hasOutstandingDebt={product.hasOutstandingDebt}
                  />
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-2 text-muted-foreground lg:order-2">
                  <WeightText value={product.weight} />
                  <span>
                    <span className="sr-only">{t("fields.purity")} </span>
                    <PurityText value={product.purity} />
                  </span>
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
  );
}
