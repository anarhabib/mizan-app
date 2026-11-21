import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ProductListItem } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { productListQuery } from "@/features/products";
import { ErrorState } from "@/shared/ui/ErrorState";
import type { SaleScope } from "../api/queries";

export function SaleProductPicker({
  scope,
  excluded,
  select,
  close,
}: {
  scope: SaleScope;
  excluded: string[];
  select: (product: ProductListItem) => void;
  close: () => void;
}) {
  const { t } = useTranslation("sales");
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
    productListQuery(scope, { q: q || undefined, status: "IN_STOCK" }),
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
    >
      <Label htmlFor="sale-product-search">{t("searchProducts")}</Label>
      <Input
        ref={searchField}
        id="sale-product-search"
        type="search"
        value={search}
        maxLength={160}
        onChange={(event) => setSearch(event.target.value)}
        className="min-h-11 lg:min-h-9"
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />
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
          {t("noProducts")}
        </p>
      )}
      {products.length > 0 && (
        <ul className="max-h-52 overflow-y-auto">
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
