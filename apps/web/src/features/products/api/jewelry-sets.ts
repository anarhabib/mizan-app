import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  JewelrySetAvailability,
  JewelrySetDetail,
  JewelrySetInput,
  JewelrySetList,
  JewelrySetPreview,
} from "@mizan/contracts";
import type { CursorPage } from "@/shared/hooks/useCursorPagination";
import { apiRequest, type ApiError } from "@/shared/lib/api";
import type { ProductScope } from "./queries";

const scopeKey = ({ organizationId, storeId }: ProductScope) =>
  ["jewelry-sets", organizationId, storeId] as const;
const detailKey = (scope: ProductScope, id?: string) =>
  [...scopeKey(scope), "detail", id] as const;
const path = ({ organizationId, storeId }: ProductScope) =>
  `/organizations/${encodeURIComponent(organizationId)}/stores/${encodeURIComponent(storeId)}/jewelry-sets`;

export function jewelrySetListQuery(
  scope: ProductScope,
  page: CursorPage,
  q: string,
  availability?: JewelrySetAvailability,
) {
  const params = new URLSearchParams({ limit: String(page.limit) });
  if (page.after) params.set("after", page.after);
  if (q) params.set("q", q);
  if (availability) params.set("availability", availability);
  return queryOptions<JewelrySetList, ApiError>({
    queryKey: [...scopeKey(scope), "list", page, q, availability],
    queryFn: ({ signal }) => apiRequest(`${path(scope)}?${params}`, { signal }),
  });
}

export function jewelrySetDetailQuery(scope: ProductScope, id?: string) {
  return queryOptions<JewelrySetDetail, ApiError>({
    queryKey: detailKey(scope, id),
    enabled: !!id,
    queryFn: ({ signal }) =>
      apiRequest(`${path(scope)}/${encodeURIComponent(id!)}`, { signal }),
  });
}

export function jewelrySetPreviewQuery(
  scope: ProductScope,
  productIds: string[],
) {
  return queryOptions<JewelrySetPreview, ApiError>({
    queryKey: [...scopeKey(scope), "preview", productIds],
    enabled: productIds.length > 0,
    queryFn: ({ signal }) =>
      apiRequest(`${path(scope)}/preview`, {
        method: "POST",
        body: { productIds },
        signal,
      }),
  });
}

function revisionPath(scope: ProductScope, set: JewelrySetDetail) {
  return `${path(scope)}/${encodeURIComponent(set.id)}?revision=${set.revision}`;
}

export function saveJewelrySet(
  scope: ProductScope,
  body: JewelrySetInput,
  set?: JewelrySetDetail,
) {
  return apiRequest<JewelrySetDetail>(
    set ? revisionPath(scope, set) : path(scope),
    {
      method: set ? "PATCH" : "POST",
      body,
    },
  );
}

export function dissolveJewelrySet(scope: ProductScope, set: JewelrySetDetail) {
  return apiRequest<void>(revisionPath(scope, set), { method: "DELETE" });
}

export function cacheJewelrySet(
  client: QueryClient,
  scope: ProductScope,
  set: JewelrySetDetail,
) {
  client.setQueryData(detailKey(scope, set.id), set);
}

export function refreshJewelrySets(client: QueryClient, scope: ProductScope) {
  const queries = client.getQueryCache().findAll({ queryKey: scopeKey(scope) });
  return Promise.all(
    queries.map(({ queryKey }) =>
      client.invalidateQueries({ queryKey, exact: true }),
    ),
  );
}
