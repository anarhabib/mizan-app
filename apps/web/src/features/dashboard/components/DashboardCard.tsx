import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { ApiError } from "@/shared/lib/api";

export function DashboardCard({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Card className={`min-w-0 gap-3 py-4 ${wide ? "sm:col-span-2" : ""}`}>
      <CardHeader className="px-4">
        <CardTitle role="heading" aria-level={2}>
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
}: {
  query: {
    data: T | undefined;
    error: Error | null;
    isPending: boolean;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  };
  children: (data: T) => ReactNode;
}) {
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
      {query.data === undefined && query.isPending && <ListSkeleton rows={3} />}
    </>
  );
}
