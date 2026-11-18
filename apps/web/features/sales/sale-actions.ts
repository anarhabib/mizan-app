"use server";

import type { ProductList, SaleCreateInput } from "@mizan/contracts";
import { apiRequest } from "../auth/session";
import { productHref, type ProductScope } from "../products/product-copy";
import { productRequest } from "../../lib/api-client";

export async function findSaleProducts(
  scope: ProductScope,
  q: string,
  after?: string,
) {
  return productRequest<ProductList>("/products", scope, {
    q,
    after,
    status: "IN_STOCK",
  });
}

export async function submitSale(
  scope: ProductScope,
  input: SaleCreateInput,
  key: string,
) {
  const result = await apiRequest(
    productHref("/sales", scope) as `/sales${string}`,
    input,
    { "Idempotency-Key": key },
  );
  return {
    status: result.status,
    error: result.error,
    id: result.data?.id as string | undefined,
  };
}
