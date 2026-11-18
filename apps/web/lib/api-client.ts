import { apiRequest } from "../features/auth/session";
import {
  productHref,
  type ProductFilters,
  type ProductScope,
} from "../features/products/product-copy";

export async function productRequest<T>(
  path: "/products" | `/products/${string}`,
  scope: ProductScope,
  filters?: ProductFilters,
  body?: unknown,
) {
  const url = productHref(path, scope, filters) as `/products${string}`;
  const result = await apiRequest(url, body);
  return { ...result, data: result.data as T | undefined };
}
