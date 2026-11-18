import Link from "next/link";
import { redirect } from "next/navigation";
import { actionClass } from "../../../../components/ui/button";
import { PageHeading } from "../../../../components/ui/page-heading";
import { Surface } from "../../../../components/ui/surface";
import { saveProduct } from "../../../../features/products/product-actions";
import {
  productHref,
  type ProductOptions,
} from "../../../../features/products/product-copy";
import { ProductForm } from "../../../../features/products/product-form";
import {
  productPage,
  type ProductSearch,
} from "../../../../features/products/product-page";
import { productRequest } from "../../../../lib/api-client";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: ProductSearch;
}) {
  const { locale, copy, scope, fallback } = await productPage(searchParams);
  if (!scope) return fallback;
  const result = await productRequest<ProductOptions>(
    "/products/options",
    scope,
  );
  if (result.status === 401) redirect("/sign-in");
  return (
    <section className="grid gap-4">
      <PageHeading
        title={copy.add}
        actions={
          <Link
            className={actionClass + " mizan-table-action"}
            href={productHref("/products", scope)}
          >
            ← {copy.back}
          </Link>
        }
      />
      <Surface className="w-full max-w-4xl box-border p-4 sm:p-5">
        {result.data ? (
          <ProductForm
            key={scope.storeId}
            locale={locale}
            options={result.data}
            scope={scope}
            save={saveProduct}
          />
        ) : (
          <p role="alert">{copy.unavailable}</p>
        )}
      </Surface>
    </section>
  );
}
