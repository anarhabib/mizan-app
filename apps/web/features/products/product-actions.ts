"use server";

import {
  parseProductCreate,
  type ProductDetail,
  type ProductPhotoUpload,
} from "@mizan/contracts";
import { redirect } from "next/navigation";
import { productRequest } from "../../lib/api-client";
import { productHref, type ProductScope } from "./product-copy";
import type { ProductFormState } from "./product-form";

export async function saveProduct(
  previous: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  const read = (key: string) => String(form.get(key) ?? "");
  const values = Object.fromEntries(
    [
      "code",
      "name",
      "category",
      "purity",
      "weight",
      "acquisitionCost",
      "currency",
      "note",
    ].map((key) => [key, read(key)]),
  );
  const preserved = { values, revision: (previous.revision ?? 0) + 1 };
  const parsed = parseProductCreate({
    ...values,
    purity: Number(values.purity),
    weight: values.weight.replace(",", "."),
    acquisitionCost: {
      amount: values.acquisitionCost.replace(",", "."),
      currency: values.currency,
    },
  });
  if ("field" in parsed) return { ...preserved, field: parsed.field };
  const scope = {
    organizationId: read("organizationId"),
    storeId: read("storeId"),
  };
  const response = await productRequest<ProductDetail>(
    "/products",
    scope,
    undefined,
    parsed.input,
  );
  if (response.status === 401) redirect("/sign-in");
  if (response.data)
    redirect(
      productHref("/products/" + encodeURIComponent(response.data.id), scope),
    );
  if (response.error?.code === "PRODUCT_CODE_CONFLICT")
    return { ...preserved, field: "code", duplicate: true };
  if (response.error?.code === "PURITY_CONFLICT")
    return { ...preserved, field: "purity" };
  return { ...preserved, failed: true };
}

export async function startProductPhoto(scope: ProductScope, id: string) {
  const result = await productRequest<ProductPhotoUpload>(
    `/products/${encodeURIComponent(id)}/photo-upload`,
    scope,
    undefined,
    {},
  );
  return result.data;
}

export async function confirmProductPhoto(
  scope: ProductScope,
  id: string,
  uploadId: string,
) {
  const result = await productRequest<unknown>(
    `/products/${encodeURIComponent(id)}/photo-confirm`,
    scope,
    undefined,
    { uploadId },
  );
  return result.status >= 200 && result.status < 300;
}
