import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { parseTablePageSize, tablePageSizes } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { OptionSelect } from "./OptionSelect";

export function CursorPagination({
  pagination,
  nextCursor,
  pending,
  label,
}: {
  pagination: ReturnType<typeof useCursorPagination>;
  nextCursor?: string;
  pending?: boolean;
  label: string;
}) {
  const id = useId();
  const { t } = useTranslation("shell");
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{t("pagination.pageSize")}</Label>
        <div className="w-21">
          <OptionSelect
            id={id}
            value={String(pagination.request.limit)}
            onChange={(value) => {
              const limit = parseTablePageSize(value);
              if (limit) pagination.setLimit(limit);
            }}
            options={tablePageSizes.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11 lg:min-h-9 lg:min-w-9"
          aria-label={t("pagination.previous")}
          title={t("pagination.previous")}
          disabled={pagination.page === 1 || pending}
          onClick={pagination.previous}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span aria-live="polite" className="text-sm tabular-nums">
          {t("pagination.page", { page: pagination.page })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11 lg:min-h-9 lg:min-w-9"
          aria-label={t("pagination.next")}
          title={t("pagination.next")}
          disabled={
            !nextCursor || pending || nextCursor === pagination.request.after
          }
          onClick={() => nextCursor && pagination.next(nextCursor)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
