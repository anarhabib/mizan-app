import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { categoryLabel, type ProductStatus } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { PurityText } from "@/shared/ui/PurityText";
import { WeightText } from "@/shared/ui/WeightText";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { CursorPagination } from "@/shared/ui/CursorPagination";
import {
  productPageQuery,
  type ProductFilters as Filters,
  type ProductScope,
} from "../api/queries";
import { ProductFilters } from "./ProductFilters";
import { ProductThumbnail } from "./ProductThumbnail";

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
  initialStatus?: ProductStatus | "all" | "SOLD_ON_CREDIT";
  dashboardFilters?: Pick<Filters, "soldOn" | "receivedOn" | "agedDays">;
  clearDashboardFilters?: () => void;
}) {
  const { t } = useTranslation("products");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Omit<Filters, "q">>({
    status:
      initialStatus === "all"
        ? undefined
        : initialStatus === "SOLD_ON_CREDIT"
          ? "SOLD"
          : initialStatus,
    credit: initialStatus === "SOLD_ON_CREDIT" ? true : undefined,
  });
  const { soldOn, receivedOn, agedDays } = dashboardFilters ?? {};

  return (
    <div id="product-inventory" className="min-w-0 space-y-4">
      {onlyInStock ? (
        <ProductSearch onSearch={setSearch} />
      ) : (
        <ProductFilters scope={scope} filters={filters} setFilters={setFilters}>
          <ProductSearch onSearch={setSearch} />
        </ProductFilters>
      )}
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
    <div
      role="search"
      className="grid w-full min-w-0 max-w-sm flex-1 gap-2 lg:min-w-48 lg:flex-[1_0_12rem]"
    >
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
  const { t, i18n } = useTranslation("products");
  const pagination = useCursorPagination(JSON.stringify(filters));
  const query = useQuery(productPageQuery(scope, filters, pagination.request));
  const products = query.data?.items ?? [];
  const filtered = Object.values(filters).some((value) => value !== undefined);

  return (
    <section
      aria-label={t("title")}
      aria-busy={query.isFetching}
      className="space-y-3"
    >
      {query.isPending && <ListSkeleton />}
      {products.length === 0 &&
        !query.isError &&
        !query.isPending &&
        !query.isPlaceholderData && (
          <EmptyState
            title={t(filtered ? "noResults" : "empty")}
            description={t(filtered ? "noResultsHint" : "description")}
          />
        )}
      {products.length > 0 && (
        <div
          inert={query.isPlaceholderData}
          className="hidden rounded-lg border border-border bg-card lg:block"
        >
          <Table aria-label={t("title")}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">{t("fields.code")}</TableHead>
                <TableHead scope="col">{t("formFields.name")}</TableHead>
                <TableHead scope="col">{t("fields.category")}</TableHead>
                <TableHead scope="col" className="text-right">
                  {t("fields.weight")}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {t("fields.purity")}
                </TableHead>
                <TableHead scope="col">{t("fields.status")}</TableHead>
                <TableHead scope="col" className="w-12">
                  <span className="sr-only">{t("detail")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="w-32 text-xs wrap-anywhere whitespace-normal text-muted-foreground">
                    {product.code}
                  </TableCell>
                  <TableCell className="w-full font-medium wrap-anywhere whitespace-normal">
                    <div className="flex items-center gap-2">
                      <ProductThumbnail src={product.thumbnailUrl} />
                      <span>{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-24 max-w-40 wrap-anywhere whitespace-normal text-muted-foreground">
                    {product.productCategory
                      ? categoryLabel(
                          product.productCategory,
                          i18n.resolvedLanguage,
                        )
                      : product.category}
                  </TableCell>
                  <TableCell className="text-right">
                    <WeightText value={product.weight} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <PurityText value={product.purity} />
                  </TableCell>
                  <TableCell>
                    <ProductStatusBadge
                      status={product.status}
                      hasOutstandingDebt={product.hasOutstandingDebt}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={`${t("detail")} · ${product.code}`}
                      onClick={(event) =>
                        inspect(product.id, event.currentTarget)
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
      {products.length > 0 && (
        <ul
          inert={query.isPlaceholderData}
          className="divide-y overflow-hidden rounded-lg border border-border bg-card lg:hidden"
        >
          {products.map((product) => (
            <li key={product.id}>
              <Button
                variant="ghost"
                type="button"
                onClick={(event) => inspect(product.id, event.currentTarget)}
                className="grid h-auto min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-none px-3 py-3 text-left text-sm font-normal whitespace-normal outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="grid min-w-0 gap-2">
                  <span className="wrap-break-word text-xs text-muted-foreground">
                    {product.code}
                  </span>
                  <span className="max-w-prose wrap-break-word font-medium">
                    {product.name}
                  </span>
                </span>
                <span className="justify-self-end">
                  <ProductStatusBadge
                    status={product.status}
                    hasOutstandingDebt={product.hasOutstandingDebt}
                  />
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-2 text-muted-foreground">
                  <WeightText value={product.weight} />
                  <span>
                    <span className="sr-only">{t("fields.purity")} </span>
                    <PurityText value={product.purity} />
                  </span>
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
  );
}
