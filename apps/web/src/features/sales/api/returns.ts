import type { QueryClient } from "@tanstack/react-query";
import type {
  SaleResult,
  SaleReturnInput,
  SaleReturnQuote,
} from "@mizan/contracts";
import { invalidateCustomers } from "@/features/customers";
import { invalidateProductInventory, productKeys } from "@/features/products";
import { apiRequest } from "@/shared/lib/api";
import {
  invalidateSaleOverviews,
  saleKeys,
  salePath,
  type SaleScope,
} from "./queries";

export function previewSaleReturn(
  scope: SaleScope,
  id: string,
  input: SaleReturnInput,
) {
  return apiRequest<SaleReturnQuote>(
    salePath(scope, `/${id}/returns/preview`),
    {
      method: "POST",
      body: input,
      signal: AbortSignal.timeout(30_000),
    },
  );
}

export async function invalidateReturnEffects(
  client: QueryClient,
  scope: SaleScope,
  sale: SaleResult,
) {
  const detail = saleKeys.detail(scope, sale.id);
  const keys = [
    detail,
    ...sale.items.map(({ product }) => productKeys.detail(scope, product.id)),
    ...client
      .getQueryCache()
      .findAll({ queryKey: saleKeys.lists(scope) })
      .map(({ queryKey }) => queryKey),
    ...client
      .getQueryCache()
      .findAll({
        queryKey: ["dashboard", scope.organizationId, scope.storeId],
      })
      .map(({ queryKey }) => queryKey),
  ];
  await Promise.all([
    invalidateSaleOverviews(client, scope),
    invalidateProductInventory(client, scope),
    sale.customerId && invalidateCustomers(client, scope, sale.customerId),
    ...keys.map((queryKey) =>
      client.invalidateQueries({ queryKey, exact: true }),
    ),
  ]);
}
