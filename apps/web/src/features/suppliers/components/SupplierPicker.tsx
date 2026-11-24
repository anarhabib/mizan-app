import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SupplierOption } from "@mizan/contracts";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { suppliersQuery, type SupplierScope } from "../api/queries";

export function useSupplierSearch(search: string) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  return query || undefined;
}

export function SupplierPicker({
  scope,
  value,
  onChange,
  onlyActive = true,
  disabled,
  label,
}: {
  scope: SupplierScope;
  value?: SupplierOption;
  onChange: (option?: SupplierOption) => void;
  onlyActive?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const { t } = useTranslation(["suppliers", "shell"]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  const q = useSupplierSearch(search);
  const pagination = useCursorPagination(q);
  const query = useQuery({
    ...suppliersQuery(
      scope,
      { q, active: onlyActive ? "true" : undefined },
      pagination.request,
    ),
    enabled: open && !disabled,
  });
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="relative grid min-w-0 gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Label htmlFor={id}>{label ?? t("supplier")}</Label>
      <div className="flex min-w-0 gap-2">
        <Button
          id={id}
          type="button"
          variant="outline"
          ref={trigger}
          disabled={disabled}
          className="min-h-11 min-w-0 flex-1 justify-between lg:min-h-9"
          aria-expanded={open}
          aria-controls={open ? `${id}-options` : undefined}
          onClick={() => {
            if (open) close();
            else {
              setSearch("");
              setOpen(true);
            }
          }}
        >
          <span className="truncate">{value?.name ?? t("chooseSupplier")}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className="min-h-11 min-w-11 lg:min-h-9 lg:min-w-9"
            aria-label={t("clearSupplier")}
            onClick={() => {
              onChange(undefined);
              close();
            }}
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      {open && !disabled && (
        <div
          id={`${id}-options`}
          className="absolute inset-x-0 top-full z-10 mt-1 grid gap-2 rounded-lg border bg-popover p-2 shadow-md"
        >
          <Label htmlFor={`${id}-search`}>{t("searchSuppliers")}</Label>
          <Input
            id={`${id}-search`}
            ref={input}
            type="search"
            maxLength={160}
            value={search}
            className="min-h-11 lg:min-h-9"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
          {query.isPending && <ListSkeleton rows={2} />}
          {query.isError && (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
              pending={query.isFetching}
            />
          )}
          {!query.isPlaceholderData &&
            query.data &&
            (query.data.items.length ? (
              <ul className="max-h-44 overflow-y-auto">
                {query.data.items.map((option) => (
                  <li key={option.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-11 w-full justify-start whitespace-normal text-left lg:min-h-9"
                      onClick={() => {
                        onChange({ id: option.id, name: option.name });
                        close();
                      }}
                    >
                      <span className="wrap-anywhere">{option.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="text-muted-foreground">
                {t("noSuppliers")}
              </p>
            ))}
          {(pagination.page > 1 || query.data?.nextCursor) && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11 lg:min-h-9 lg:min-w-9"
                aria-label={t("pagination.previous", { ns: "shell" })}
                disabled={pagination.page === 1 || query.isFetching}
                onClick={pagination.previous}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11 lg:min-h-9 lg:min-w-9"
                aria-label={t("pagination.next", { ns: "shell" })}
                disabled={!query.data?.nextCursor || query.isFetching}
                onClick={() => {
                  if (query.data?.nextCursor)
                    pagination.next(query.data.nextCursor);
                }}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
