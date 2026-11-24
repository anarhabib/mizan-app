import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  RepairCommand,
  RepairDetail,
  RepairHistory,
} from "@mizan/contracts";
import {
  refreshSupplierProductStatus,
  useFinancialAttempt,
} from "@/features/suppliers";
import type { CursorPage } from "@/shared/hooks/useCursorPagination";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import { refreshPurchaseProducts, type ProductScope } from "./queries";

const repairKey = (
  { organizationId, storeId }: ProductScope,
  productId: string,
) => ["repairs", organizationId, storeId, productId] as const;
const path = ({ organizationId, storeId }: ProductScope, productId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/repairs`;

export function repairHistoryQuery(
  scope: ProductScope,
  productId: string,
  page: CursorPage,
) {
  const query = new URLSearchParams({ limit: String(page.limit) });
  if (page.after) query.set("after", page.after);
  return queryOptions<RepairHistory, ApiError>({
    queryKey: [
      ...repairKey(scope, productId),
      "history",
      page.limit,
      page.after,
    ],
    queryFn: ({ signal }) =>
      apiRequest(`${path(scope, productId)}?${query}`, { signal }),
  });
}

export function repairDetailQuery(
  scope: ProductScope,
  productId: string,
  id?: string,
) {
  return queryOptions<RepairDetail, ApiError>({
    queryKey: [...repairKey(scope, productId), "detail", id],
    enabled: Boolean(id),
    queryFn: ({ signal }) =>
      apiRequest(`${path(scope, productId)}/${encodeURIComponent(id!)}`, {
        signal,
      }),
  });
}

export function useRepairCommand(scope: ProductScope, productId: string) {
  const client = useQueryClient();
  const submit = useFinancialAttempt<RepairCommand>(
    scope,
    `repair/${productId}`,
  );
  return useMutation<{ id: string }, ApiError, RepairCommand>({
    retry: false,
    networkMode: "always",
    mutationFn: (command) =>
      submit(command, ({ body, key }) =>
        apiRequest(path(scope, productId), {
          method: "POST",
          body,
          headers: { "Idempotency-Key": key },
          signal: AbortSignal.timeout(30_000),
        }),
      ),
    onSuccess: async (_result, { action }) => {
      const queries = client
        .getQueryCache()
        .findAll({ queryKey: repairKey(scope, productId) });
      await Promise.all([
        ...queries.map(({ queryKey }) =>
          client.invalidateQueries({ queryKey, exact: true }),
        ),
        ...(action === "send" || action === "complete" || action === "cancel"
          ? [
              refreshPurchaseProducts(client, scope, [productId]),
              refreshSupplierProductStatus(client, scope),
            ]
          : []),
      ]);
    },
  });
}
