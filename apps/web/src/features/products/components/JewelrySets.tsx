import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { JewelrySetAvailability } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { CursorPagination } from "@/shared/ui/CursorPagination";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { PageHeader } from "@/shared/ui/PageHeader";
import { WeightText } from "@/shared/ui/WeightText";
import { jewelrySetListQuery } from "../api/jewelry-sets";
import type { ProductScope } from "../api/queries";
import { JewelrySetPanel } from "./JewelrySetPanel";
import { SetAvailability } from "./JewelrySetRecord";
import { ProductsNavigation } from "./ProductsNavigation";

export function JewelrySets({
  scope,
  owner,
}: {
  scope: ProductScope;
  owner: boolean;
}) {
  const { t } = useTranslation("products");
  const searchId = useId();
  const filterId = useId();
  const createButton = useRef<HTMLButtonElement>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [q, setQuery] = useState("");
  const [availability, setAvailability] = useState<JewelrySetAvailability>();
  const [panel, setPanel] = useState<{ id?: string; opener: HTMLElement }>();
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const pagination = useCursorPagination(JSON.stringify([q, availability]));
  const sets = useQuery(
    jewelrySetListQuery(scope, pagination.request, q, availability),
  );

  return (
    <>
      <PageHeader
        title={t("sets.title")}
        actions={
          owner && (
            <Button
              ref={createButton}
              className="min-h-11 lg:min-h-9"
              onClick={(event) => setPanel({ opener: event.currentTarget })}
            >
              <Plus aria-hidden="true" />
              {t("sets.create")}
            </Button>
          )
        }
      />
      <ProductsNavigation view="sets" />
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,20rem)_minmax(0,15rem)]">
        <div className="grid gap-2">
          <Label htmlFor={searchId}>{t("sets.search")}</Label>
          <Input
            id={searchId}
            ref={searchField}
            type="search"
            value={search}
            maxLength={160}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-11 lg:min-h-9"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={filterId}>{t("sets.availability")}</Label>
          <OptionSelect
            id={filterId}
            value={availability ?? "all"}
            onChange={(value) =>
              setAvailability(
                value === "available" || value === "unavailable"
                  ? value
                  : undefined,
              )
            }
            options={[
              { value: "all", label: t("sets.all") },
              { value: "available", label: t("sets.available") },
              { value: "unavailable", label: t("sets.unavailable") },
            ]}
          />
        </div>
      </div>
      {sets.isPending && <ListSkeleton rows={4} />}
      {sets.isError && (
        <ErrorState
          error={sets.error}
          pending={sets.isFetching}
          retry={() => void sets.refetch()}
        />
      )}
      {sets.data && (
        <div className="grid gap-3">
          {sets.data.items.length === 0 ? (
            <EmptyState
              title={t(q || availability ? "noResults" : "sets.empty")}
            />
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {sets.data.items.map(({ id, name, totals }) => (
                <li key={id}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md p-3 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={(event) =>
                      setPanel({ id, opener: event.currentTarget })
                    }
                  >
                    <span className="min-w-0">
                      <span className="block font-medium wrap-anywhere">
                        {name}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {t("sets.itemCount", { count: totals.itemCount })} ·{" "}
                        <WeightText value={totals.grossWeight} />
                      </span>
                    </span>
                    <SetAvailability totals={totals} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(sets.data.nextCursor || pagination.page > 1) && (
            <CursorPagination
              label={t("sets.title")}
              pagination={pagination}
              nextCursor={sets.data.nextCursor}
              pending={sets.isFetching}
            />
          )}
        </div>
      )}
      {panel && (
        <JewelrySetPanel
          scope={scope}
          id={panel.id}
          owner={owner}
          opener={panel.opener}
          close={() => setPanel(undefined)}
          show={(id) => setPanel({ ...panel, id })}
          restoreFallbackFocus={() =>
            (createButton.current ?? searchField.current)?.focus()
          }
        />
      )}
    </>
  );
}
