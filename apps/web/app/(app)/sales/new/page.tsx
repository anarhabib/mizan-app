import type { ProductDetail } from "@mizan/contracts";
import { redirect } from "next/navigation";
import { apiRequest } from "../../../../features/auth/session";
import { productHref } from "../../../../features/products/product-copy";
import {
  productPage,
  type ProductSearch,
} from "../../../../features/products/product-page";
import {
  saleCopy,
  type SaleOptions,
} from "../../../../features/sales/sale-copy";
import { SaleForm } from "../../../../features/sales/sale-form";
import { productRequest } from "../../../../lib/api-client";

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: ProductSearch;
}) {
  const { scope, locale, fallback } = await productPage(searchParams);
  if (!scope) return fallback;
  const { productId } = (await searchParams) as { productId?: string };
  const [options, product] = await Promise.all([
    apiRequest(productHref("/sales/options", scope) as `/sales${string}`),
    typeof productId === "string"
      ? productRequest<ProductDetail>(
          `/products/${encodeURIComponent(productId)}`,
          scope,
        )
      : undefined,
  ]);
  if (options.status === 401 || product?.status === 401) redirect("/sign-in");
  if (!options.data)
    return <p role="alert">{saleCopy[locale].optionsFailed}</p>;
  return (
    <SaleForm
      key={scope.organizationId + ":" + scope.storeId + ":" + (productId ?? "")}
      locale={locale}
      scope={scope}
      options={options.data as SaleOptions}
      initialProduct={product?.data}
      missingProduct={!!product && !product.data}
    />
  );
}
