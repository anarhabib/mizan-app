import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { ApiError } from "@/shared/lib/api";

export function DashboardCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 gap-3 py-4 shadow-none">
      <CardHeader className="px-4">
        <CardTitle role="heading" aria-level={3} className="wrap-anywhere">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 px-4">{children}</CardContent>
    </Card>
  );
}

export function QueryContent<T>({
  query,
  children,
  rows = 3,
  chart = false,
}: {
  query: {
    data: T | undefined;
    error: Error | null;
    isPending: boolean;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  };
  children: (data: T) => ReactNode;
  rows?: number;
  chart?: boolean;
}) {
  const { t } = useTranslation("shell");
  return (
    <>
      {query.data !== undefined && children(query.data)}
      {query.error && (
        <ErrorState
          error={
            query.error instanceof ApiError
              ? query.error
              : new ApiError(500, "INTERNAL_ERROR", query.error.message)
          }
          pending={query.isFetching}
          retry={() => void query.refetch()}
        />
      )}
      {query.data === undefined &&
        query.isPending &&
        (chart ? (
          <div role="status" className="space-y-2">
            <span className="sr-only">{t("loading")}</span>
            <Skeleton className="h-10 w-32 motion-reduce:animate-none" />
            <Skeleton className="h-44 w-full motion-reduce:animate-none" />
          </div>
        ) : (
          <ListSkeleton rows={rows} className="h-8" />
        ))}
    </>
  );
}
