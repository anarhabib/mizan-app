import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  PurchaseDetail,
  PurchaseInput,
  PurchaseReceipt,
  PurchaseSummary,
  ReceivedProduct,
  StoreContext,
  Supplier,
  SupplierActivity,
  SupplierInput,
  SupplierOverview,
  SupplierPage,
  SupplierPayment,
  SupplierPaymentInput,
} from "@mizan/contracts";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import type { CursorPage } from "@/shared/hooks/useCursorPagination";

export type SupplierScope = Pick<StoreContext, "organizationId" | "storeId">;
type Filters = Record<string, string | undefined>;
const scopeKey = ({ organizationId, storeId }: SupplierScope) =>
  ["suppliers", organizationId, storeId] as const;

function storePath(
  scope: SupplierScope,
  path: string,
  filters?: Filters & Partial<Record<"limit", string>>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters ?? {}))
    if (value !== undefined) params.set(key, value);
  const suffix = params.size ? `?${params}` : "";
  return `/organizations/${scope.organizationId}/stores/${scope.storeId}/${path}${suffix}`;
}

function pageQuery<T>(
  scope: SupplierScope,
  path: string,
  filters: Filters,
  page: CursorPage,
) {
  return queryOptions<SupplierPage<T>, ApiError>({
    queryKey: [...scopeKey(scope), path, filters, page],
    queryFn: ({ signal }) =>
      apiRequest(
        storePath(scope, path, {
          ...filters,
          after: page.after,
          limit: String(page.limit),
        }),
        { signal },
      ),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export const suppliersQuery = (
  scope: SupplierScope,
  filters: Filters,
  page: CursorPage,
) => pageQuery<Supplier>(scope, "suppliers", filters, page);
export const purchasesQuery = (
  scope: SupplierScope,
  filters: Filters,
  page: CursorPage,
) => pageQuery<PurchaseSummary>(scope, "purchases", filters, page);
export const paymentsQuery = (
  scope: SupplierScope,
  id: string,
  filters: Filters,
  page: CursorPage,
) =>
  pageQuery<SupplierPayment>(scope, `suppliers/${id}/payments`, filters, page);
export const supplierProductsQuery = (
  scope: SupplierScope,
  id: string,
  filters: Filters,
  page: CursorPage,
) =>
  pageQuery<ReceivedProduct>(scope, `suppliers/${id}/products`, filters, page);
export const supplierActivityQuery = (
  scope: SupplierScope,
  id: string,
  page: CursorPage,
) => pageQuery<SupplierActivity>(scope, `suppliers/${id}/activity`, {}, page);

function detailQuery<T>(scope: SupplierScope, path: string) {
  return queryOptions<T, ApiError>({
    queryKey: [...scopeKey(scope), path],
    queryFn: ({ signal }) => apiRequest(storePath(scope, path), { signal }),
    staleTime: 15_000,
  });
}

export const supplierQuery = (scope: SupplierScope, id: string) =>
  detailQuery<SupplierOverview>(scope, `suppliers/${id}`);
export const purchaseQuery = (scope: SupplierScope, id: string) =>
  detailQuery<PurchaseDetail>(scope, `purchases/${id}`);

function invalidateSupplierData(
  client: QueryClient,
  scope: SupplierScope,
  paths: string[],
) {
  return Promise.all(
    client
      .getQueryCache()
      .findAll({ queryKey: scopeKey(scope) })
      .filter(({ queryKey }) => paths.includes(String(queryKey[3])))
      .map(({ queryKey }) =>
        client.invalidateQueries({ queryKey, exact: true }),
      ),
  );
}

export function refreshSupplierProductStatus(
  client: QueryClient,
  scope: SupplierScope,
) {
  return Promise.all(
    client
      .getQueryCache()
      .findAll({ queryKey: scopeKey(scope) })
      .filter(({ queryKey }) =>
        /^purchases\/[^/]+$|^suppliers\/[^/]+\/products$/.test(
          String(queryKey[3]),
        ),
      )
      .map(({ queryKey }) =>
        client.invalidateQueries({ queryKey, exact: true }),
      ),
  );
}

export function useSaveSupplier(scope: SupplierScope, id?: string) {
  const client = useQueryClient();
  return useMutation<Supplier, ApiError, Partial<SupplierInput>>({
    retry: false,
    mutationFn: (body) =>
      apiRequest(storePath(scope, id ? `suppliers/${id}` : "suppliers"), {
        method: id ? "PATCH" : "POST",
        body,
      }),
    onSuccess: (supplier) => {
      const paths = [
        "suppliers",
        "purchases",
        `suppliers/${supplier.id}`,
        `suppliers/${supplier.id}/activity`,
      ];
      for (const [key, purchase] of client.getQueriesData<PurchaseDetail>({
        queryKey: scopeKey(scope),
      })) {
        if (
          /^purchases\/[^/]+$/.test(String(key[3])) &&
          purchase?.supplier.id === supplier.id
        )
          paths.push(String(key[3]));
      }
      return invalidateSupplierData(client, scope, paths);
    },
  });
}

type Attempt<T> = { body: T; key: string };

export function refreshSupplierActivity(
  client: QueryClient,
  scope: SupplierScope,
  supplierId: string,
) {
  return invalidateSupplierData(client, scope, [
    `suppliers/${supplierId}/activity`,
  ]);
}

export function refreshSupplierPurchase(
  client: QueryClient,
  scope: SupplierScope,
  supplierId: string,
) {
  return invalidateSupplierData(client, scope, [
    "suppliers",
    "purchases",
    `suppliers/${supplierId}`,
    `suppliers/${supplierId}/products`,
    `suppliers/${supplierId}/payments`,
    `suppliers/${supplierId}/activity`,
  ]);
}

export function useRegisterPurchase(scope: SupplierScope) {
  const client = useQueryClient();
  return useMutation<PurchaseReceipt, ApiError, Attempt<PurchaseInput>>({
    retry: false,
    mutationFn: ({ body, key }) =>
      apiRequest(storePath(scope, "purchases"), {
        method: "POST",
        body,
        headers: { "Idempotency-Key": key },
      }),
    onSuccess: ({ supplierId }) =>
      refreshSupplierPurchase(client, scope, supplierId),
  });
}

export function useRecordPayment(
  scope: SupplierScope,
  supplierId: string,
  purchaseId: string,
) {
  const client = useQueryClient();
  const refresh = () =>
    invalidateSupplierData(client, scope, [
      "suppliers",
      "purchases",
      `purchases/${purchaseId}`,
      `suppliers/${supplierId}`,
      `suppliers/${supplierId}/payments`,
      `suppliers/${supplierId}/activity`,
    ]);
  return useMutation<SupplierPayment, ApiError, Attempt<SupplierPaymentInput>>({
    retry: false,
    mutationFn: ({ body, key }) =>
      apiRequest(storePath(scope, `purchases/${purchaseId}/payments`), {
        method: "POST",
        body,
        headers: { "Idempotency-Key": key },
      }),
    onSuccess: refresh,
    onError: (error) => {
      if (error.status === 409) return refresh();
    },
  });
}
