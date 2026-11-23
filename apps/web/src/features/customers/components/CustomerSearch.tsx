import { useEffect, useId, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CustomerSummary } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { CursorPagination } from "@/shared/ui/CursorPagination";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import {
  customerListQuery,
  customerPageQuery,
  type CustomerScope,
} from "../api/queries";

type ResultsProps = {
  scope: CustomerScope;
  render: (customer: CustomerSummary) => ReactNode;
  outstanding?: boolean;
  search: string;
};

export function CustomerSearch({
  paged,
  ...props
}: Omit<ResultsProps, "search"> & { paged?: boolean }) {
  const { t } = useTranslation("customers");
  const id = useId();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);
  return (
    <div className="grid gap-4">
      <div className={paged ? "grid max-w-sm gap-2" : "grid gap-2"}>
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
      {paged ? (
        <CustomerDirectoryResults {...props} search={search} />
      ) : (
        <CustomerPickerResults {...props} search={search} />
      )}
    </div>
  );
}

function CustomerRows({
  rows,
  render,
  fetching,
  placeholder,
}: {
  rows: CustomerSummary[];
  render: ResultsProps["render"];
  fetching: boolean;
  placeholder?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <ul
      aria-busy={fetching}
      inert={placeholder}
      className="divide-y rounded-lg border bg-card"
    >
      {rows.map((customer) => (
        <li key={customer.id}>{render(customer)}</li>
      ))}
    </ul>
  );
}

function CustomerDirectoryResults({
  scope,
  search,
  outstanding,
  render,
}: ResultsProps) {
  const { t } = useTranslation("customers");
  const pagination = useCursorPagination(
    JSON.stringify([scope.organizationId, scope.storeId, search, outstanding]),
  );
  const query = useQuery(
    customerPageQuery(scope, search, outstanding, pagination.request),
  );
  const rows = query.data?.items ?? [];
  return (
    <>
      {query.isPending && <ListSkeleton rows={3} />}
      <CustomerRows
        rows={rows}
        render={render}
        fetching={query.isFetching}
        placeholder={query.isPlaceholderData}
      />
      {query.isError && (
        <ErrorState
          error={query.error}
          pending={query.isFetching}
          retry={() => void query.refetch()}
        />
      )}
      {query.isSuccess && !query.isPlaceholderData && !rows.length && (
        <EmptyState title={t(search ? "noMatches" : "empty")} />
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={query.data?.nextCursor}
        pending={query.isPending || query.isPlaceholderData}
        label={t("title")}
      />
    </>
  );
}

function CustomerPickerResults({
  scope,
  search,
  outstanding,
  render,
}: ResultsProps) {
  const { t } = useTranslation("customers");
  const query = useInfiniteQuery(customerListQuery(scope, search, outstanding));
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
      {query.isPending && <ListSkeleton rows={3} />}
      <CustomerRows rows={rows} render={render} fetching={query.isFetching} />
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
    </>
  );
}
