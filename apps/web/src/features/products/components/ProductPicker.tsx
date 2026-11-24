import { useEffect, useId, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ProductListItem } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { productListQuery, type ProductScope } from "../api/queries";

export function ProductPicker({
  scope,
  excluded,
  select,
  close,
  setEligible,
}: {
  scope: ProductScope;
  excluded: string[];
  select: (product: ProductListItem) => void;
  close: () => void;
  setEligible?: true;
}) {
  const { t } = useTranslation(["sales", "products"]);
  const inputId = useId();
  const [search, setSearch] = useState("");
  const [q, setQuery] = useState("");
  const searchField = useRef<HTMLInputElement>(null);
  useEffect(() => searchField.current?.focus(), []);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setQuery(search.trim().replaceAll("\0", "")),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = useInfiniteQuery(
    productListQuery(scope, {
      q: q || undefined,
      status: "IN_STOCK",
      setEligible,
    }),
  );
  const products = query.isPlaceholderData
    ? []
    : (query.data?.pages
        .flatMap(({ items }) => items)
        .filter(
          (item) => item.status === "IN_STOCK" && !excluded.includes(item.id),
        ) ?? []);
  return (
    <div
      className="grid gap-2 rounded-lg border border-border bg-muted p-3"
      aria-busy={query.isFetching}
      data-form-panel-escape={setEligible ? "" : undefined}
      onKeyDown={(event) => {
        if (setEligible && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <Label htmlFor={inputId}>
        {setEligible
          ? t("sets.searchProducts", { ns: "products" })
          : t("searchProducts")}
      </Label>
      <Input
        ref={searchField}
        id={inputId}
        type="search"
        value={search}
        maxLength={160}
        onChange={(event) => setSearch(event.target.value)}
        className="min-h-11 lg:min-h-9"
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />
      {setEligible && query.isPending && <ListSkeleton rows={2} />}
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
      {!query.isFetching && !query.error && !products.length && (
        <p role="status" className="text-muted-foreground">
          {setEligible
            ? t("sets.noEligibleProducts", { ns: "products" })
            : t("noProducts")}
        </p>
      )}
      {products.length > 0 && (
        <ul className={setEligible ? undefined : "max-h-52 overflow-y-auto"}>
          {products.map((product) => (
            <li key={product.id}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => select(product)}
                className="h-auto min-h-11 w-full justify-start text-left whitespace-normal wrap-anywhere lg:min-h-9"
              >
                {product.code} · {product.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {query.hasNextPage && !query.isFetchNextPageError && (
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetching}
            className="min-h-11 lg:min-h-9"
            onClick={() => void query.fetchNextPage()}
          >
            {t(query.isFetchingNextPage ? "loadingMore" : "loadMore")}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={close}
          className="min-h-11 lg:min-h-9"
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
