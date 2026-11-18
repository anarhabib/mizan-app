import type { ProductList as Inventory } from "@mizan/contracts";
import { redirect } from "next/navigation";
import { ProductList } from "../../../features/products/product-list";
import {
  productPage,
  type ProductSearch,
} from "../../../features/products/product-page";
import { productRequest } from "../../../lib/api-client";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: ProductSearch;
}) {
  const { scope, locale, query, fallback } = await productPage(searchParams);
  if (!scope) return fallback;
  const { q, status, after, category, purity } = query;
  const filters = {
    q: typeof q === "string" ? q : undefined,
    status: status === "IN_STOCK" || status === "SOLD" ? status : undefined,
    after: typeof after === "string" ? after : undefined,
    category: typeof category === "string" ? category : undefined,
    purity: typeof purity === "string" ? purity : undefined,
  };
  const result = await productRequest<Inventory>("/products", scope, {
    ...filters,
    facets: "1",
  });
  if (result.status === 401) redirect("/sign-in");
  return (
    <ProductList
      locale={locale}
      scope={scope}
      filters={filters}
      result={result.data}
    />
  );
}
