import type { CSSProperties, ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type {
  MoneyInput,
  PurchasePaymentStatus,
  SupplierPage,
} from "@mizan/contracts";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { CursorPagination } from "@/shared/ui/CursorPagination";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { ApiError } from "@/shared/lib/api";
import { resources } from "@/shared/lib/i18n";
import { formatPayable } from "../lib/financial";

export const controlClass = "min-h-11 lg:min-h-9";

export function Payable({ value }: { value: MoneyInput }) {
  const { i18n } = useTranslation();
  return (
    <span className="tabular-nums">
      {formatPayable(value, i18n.resolvedLanguage ?? "az")}
    </span>
  );
}

export function CalendarDate({ value }: { value: string }) {
  const { i18n } = useTranslation();
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))}
    </time>
  );
}

export function PurchaseStatus({ value }: { value: PurchasePaymentStatus }) {
  const { t } = useTranslation("suppliers");
  return (
    <Badge
      variant={
        value === "PAID"
          ? "success"
          : value === "PARTIALLY_PAID"
            ? "warning"
            : "destructive"
      }
    >
      {t(`paymentStatus.${value}`)}
    </Badge>
  );
}

export function Fact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 wrap-anywhere">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

export function Listing<T>({
  query,
  pagination,
  empty,
  label,
  action,
  children,
}: {
  query: UseQueryResult<SupplierPage<T>, ApiError>;
  pagination: ReturnType<typeof useCursorPagination>;
  empty: string;
  label: string;
  action?: ReactNode;
  children: (items: T[]) => ReactNode;
}) {
  return (
    <section
      className="grid min-w-0 gap-3"
      aria-label={label}
      aria-busy={query.isFetching}
    >
      {query.isPending && <ListSkeleton rows={4} />}
      {query.isError && (
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
          pending={query.isFetching}
        />
      )}
      {query.data && (
        <>
          {query.data.items.length ? (
            children(query.data.items)
          ) : (
            <EmptyState title={empty} action={action} />
          )}
          <CursorPagination
            pagination={pagination}
            nextCursor={query.data.nextCursor}
            pending={query.isFetching || query.isPlaceholderData}
            label={label}
          />
        </>
      )}
    </section>
  );
}

export function LedgerRows({
  columns,
  rows,
}: {
  columns: string[];
  rows: { id: string; cells: ReactNode[] }[];
}) {
  const grid = "lg:grid-cols-[var(--ledger-columns)]";
  return (
    <div
      className="overflow-hidden rounded-lg border bg-card"
      style={
        {
          "--ledger-columns": `repeat(${columns.length}, minmax(0, 1fr))`,
        } as CSSProperties
      }
    >
      <div
        aria-hidden="true"
        className={`hidden gap-3 border-b bg-muted px-3 py-2 font-medium lg:grid ${grid}`}
      >
        {columns.map((label) => (
          <span key={label} className="wrap-anywhere">
            {label}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {rows.map(({ id, cells }) => (
          <li key={id}>
            <dl
              className={`grid grid-cols-2 gap-x-3 gap-y-2 p-3 sm:grid-cols-3 ${grid}`}
            >
              {cells.map((cell, index) => (
                <div
                  key={columns[index]}
                  className={`min-w-0 wrap-anywhere ${index === 0 ? "col-span-full lg:col-span-1" : ""}`}
                >
                  <dt
                    className={
                      index === 0
                        ? "sr-only"
                        : "text-xs text-muted-foreground lg:sr-only"
                    }
                  >
                    {columns[index]}
                  </dt>
                  <dd>{cell ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  set,
  options,
}: {
  label: string;
  value?: string;
  set: (value?: string) => void;
  options: { value: string; label: string }[];
}) {
  const { t } = useTranslation("suppliers");
  const id = useId();
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <OptionSelect
        id={id}
        value={value ?? "all"}
        onChange={(next) => set(next === "all" ? undefined : next)}
        options={[{ value: "all", label: t("all") }, ...options]}
      />
    </div>
  );
}

export function TextFilter({
  label,
  value,
  set,
  type = "search",
  maxLength = 160,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: "search" | "date" | "text";
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(event) => set(event.target.value)}
        className={controlClass}
      />
    </div>
  );
}

export function WriteError({
  error,
  replayable = false,
}: {
  error: unknown;
  replayable?: boolean;
}) {
  const { t } = useTranslation(["errors", "suppliers"]);
  if (!error) return null;
  if (error instanceof ApiError) {
    const key = Object.hasOwn(resources.az.errors, error.code)
      ? (error.code as keyof typeof resources.az.errors)
      : "generic";
    return (
      <p role="alert" className="text-destructive">
        {t(key)}
        {error.isNetwork && replayable && (
          <> {t("retrySame", { ns: "suppliers" })}</>
        )}
      </p>
    );
  }
  return (
    <p role="alert" className="text-destructive">
      {t("generic")}
    </p>
  );
}
