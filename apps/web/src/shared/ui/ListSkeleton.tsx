import { cn } from "cn";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
export function ListSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  const { t } = useTranslation("shell");
  return (
    <div role="status" className="min-w-0">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton
            key={index}
            className={cn("h-14 w-full motion-reduce:animate-none", className)}
          />
        ))}
      </div>
    </div>
  );
}
