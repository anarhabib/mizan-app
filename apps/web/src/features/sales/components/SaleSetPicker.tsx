import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jewelrySetListQuery, ProductPanel } from "@/features/products";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { CursorPagination } from "@/shared/ui/CursorPagination";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import type { SaleScope } from "../api/queries";

export function SaleSetPicker({
  scope,
  opener,
  close,
  select,
}: {
  scope: SaleScope;
  opener: HTMLElement;
  close: () => void;
  select: (id: string) => void;
}) {
  const { t } = useTranslation("sales");
  const inputId = useId();
  const searchField = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [q, setQuery] = useState("");
  useEffect(() => searchField.current?.focus(), []);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setQuery(search.trim().replaceAll("\0", "")),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);
  const pagination = useCursorPagination(q);
  const sets = useQuery(
    jewelrySetListQuery(scope, pagination.request, q, "available"),
  );
  return (
    <ProductPanel title={t("chooseCompleteSet")} opener={opener} close={close}>
      <div className="grid gap-3">
        <Label htmlFor={inputId}>{t("searchSets")}</Label>
        <Input
          id={inputId}
          ref={searchField}
          type="search"
          maxLength={160}
          className="min-h-11 lg:min-h-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {sets.isPending && <ListSkeleton rows={3} />}
        {sets.isError && (
          <ErrorState
            error={sets.error}
            pending={sets.isFetching}
            retry={() => void sets.refetch()}
          />
        )}
        {sets.data && (
          <>
            {sets.data.items.length ? (
              <ul className="divide-y rounded-lg border">
                {sets.data.items.map(({ id, name, totals }) => (
                  <li key={id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-11 w-full flex-col items-start gap-1 p-3 text-left whitespace-normal wrap-anywhere lg:min-h-9"
                      onClick={() => select(id)}
                    >
                      <span className="w-full">{name}</span>
                      <span className="text-muted-foreground">
                        {t("completeSetCount", { count: totals.itemCount })}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="text-muted-foreground">
                {t("noAvailableSets")}
              </p>
            )}
            {(sets.data.nextCursor || pagination.page > 1) && (
              <CursorPagination
                label={t("chooseCompleteSet")}
                pagination={pagination}
                nextCursor={sets.data.nextCursor}
                pending={sets.isFetching}
              />
            )}
          </>
        )}
      </div>
    </ProductPanel>
  );
}
