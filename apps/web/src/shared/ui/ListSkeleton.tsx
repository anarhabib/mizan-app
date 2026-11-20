import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useTranslation("shell");
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton
            key={index}
            className="mb-3 h-14 w-full motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
