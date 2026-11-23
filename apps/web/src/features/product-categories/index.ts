import { queryOptions } from "@tanstack/react-query";
import type { ProductCategory } from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";

export function categoryPath(organizationId: string) {
  return `/organizations/${encodeURIComponent(organizationId)}/product-categories`;
}

export function categoryQuery(organizationId: string, all: boolean) {
  return queryOptions<ProductCategory[], ApiError>({
    queryKey: ["product-categories", organizationId, all] as const,
    queryFn: ({ signal }) =>
      apiRequest<ProductCategory[]>(
        categoryPath(organizationId) + (all ? "?all=1" : ""),
        { signal },
      ),
    staleTime: 60_000,
  });
}
