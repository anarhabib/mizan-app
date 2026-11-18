import Link from "next/link";
import { redirect } from "next/navigation";
import type { ProductDetail as Product } from "@mizan/contracts";
import { productHref } from "../../../../features/products/product-copy";
import { ProductDetail } from "../../../../features/products/product-detail";
import {
  productPage,
  type ProductSearch,
} from "../../../../features/products/product-page";
import { productRequest } from "../../../../lib/api-client";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ProductSearch;
}) {
  const [{ id }, { scope, locale, copy, fallback }] = await Promise.all([
    params,
    productPage(searchParams),
  ]);
  if (!scope) return fallback;
  const result = await productRequest<Product>(
    `/products/${encodeURIComponent(id)}`,
    scope,
  );
  if (result.status === 401) redirect("/sign-in");
  return result.data ? (
    <ProductDetail
      key={result.data.id}
      locale={locale}
      scope={scope}
      product={result.data}
    />
  ) : (
    <section className="grid gap-4">
      <Link className="w-fit underline" href={productHref("/products", scope)}>
        {copy.back}
      </Link>
      <p role="alert">
        {result.status === 404 ? copy.missing : copy.unavailable}
      </p>
    </section>
  );
}
