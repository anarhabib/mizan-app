import { useEffect, useId, useState, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CustomerSummary } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { customerListQuery, type CustomerScope } from "../api/queries";

export function CustomerSearch({
  scope,
  render,
  outstanding,
}: {
  scope: CustomerScope;
  render: (customer: CustomerSummary) => ReactNode;
  outstanding?: boolean;
}) {
  const { t } = useTranslation("customers");
  const id = useId();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);
  const query = useInfiniteQuery(customerListQuery(scope, search, outstanding));
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={id}>{t("search")}</Label>
        <Input
          id={id}
          type="search"
          className="min-h-11 lg:min-h-9"
          maxLength={160}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
      </div>
      {query.isPending && <ListSkeleton rows={3} />}
      {rows.length > 0 && (
        <ul
          aria-busy={query.isFetching}
          className="divide-y rounded-lg border bg-card"
        >
          {rows.map((customer) => (
            <li key={customer.id}>{render(customer)}</li>
          ))}
        </ul>
      )}
      {query.isError && (
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
      {!query.isPending && !query.isError && !rows.length && (
        <EmptyState title={t(search ? "noMatches" : "empty")} />
      )}
      {query.hasNextPage &&
        !query.isPlaceholderData &&
        !query.isFetchNextPageError && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 justify-self-start lg:min-h-9"
            disabled={query.isFetching}
            onClick={() => void query.fetchNextPage()}
          >
            {t(query.isFetchingNextPage ? "loading" : "loadMore")}
          </Button>
        )}
    </div>
  );
}
