import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ProductAcquisitionInput,
  ProductRegistrationInput,
  ProductRegistrationReceipt,
  ProductPhotoConfirmInput,
  ProductPhotoUpload,
} from "@mizan/contracts";
import { ApiError, apiRequest } from "@/shared/lib/api";
import { prepareProductPhoto } from "../lib/photo";
import {
  invalidateProductInventory,
  productKeys,
  productPath,
  refreshPurchaseProducts,
  type ProductScope,
} from "./queries";
import {
  refreshSupplierActivity,
  refreshSupplierPurchase,
} from "@/features/suppliers";

export function useRegisterProducts(scope: ProductScope) {
  const client = useQueryClient();
  return useMutation<
    ProductRegistrationReceipt,
    ApiError,
    { body: ProductRegistrationInput; key: string }
  >({
    mutationKey: productKeys.create(scope),
    retry: false,
    mutationFn: ({ body, key }) =>
      apiRequest(productPath(scope, "/registration"), {
        method: "POST",
        body,
        headers: { "Idempotency-Key": key },
      }),
    onSuccess: ({ productIds }, { body }) => {
      void refreshPurchaseProducts(client, scope, productIds);
      if (body.source === "SUPPLIER_PURCHASE")
        void refreshSupplierPurchase(client, scope, body.purchase.supplierId);
      else if (body.historicalSupplierId)
        void refreshSupplierActivity(client, scope, body.historicalSupplierId);
    },
  });
}

export function useLinkHistoricalSupplier(scope: ProductScope, id: string) {
  const client = useQueryClient();
  return useMutation<void, ApiError, string>({
    retry: false,
    mutationFn: (supplierId: string) =>
      apiRequest<void>(
        productPath(scope, `/${encodeURIComponent(id)}/historical-supplier`),
        { method: "PATCH", body: { supplierId } },
      ),
    onSuccess: (_, supplierId) =>
      Promise.all([
        client.invalidateQueries({
          queryKey: productKeys.detail(scope, id),
          exact: true,
        }),
        refreshSupplierActivity(client, scope, supplierId),
      ]),
  });
}

export function useEditProductAcquisition(scope: ProductScope, id: string) {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({
        queryKey: productKeys.detail(scope, id),
        exact: true,
      }),
      invalidateProductInventory(client, scope),
    ]);

  return useMutation({
    mutationKey: productKeys.edit(scope, id),
    retry: false,
    mutationFn: ({
      weight,
      netGoldWeight,
      acquisitionCostPerGram,
      acquisitionCost,
      acquisitionBreakdown,
      fixedSellingPrice,
      categoryId,
    }: ProductAcquisitionInput & { categoryId?: string }) =>
      apiRequest<void>(
        productPath(scope, `/${encodeURIComponent(id)}/acquisition`),
        {
          method: "PATCH",
          body: {
            weight,
            netGoldWeight,
            acquisitionCostPerGram,
            acquisitionCost,
            acquisitionBreakdown,
            fixedSellingPrice,
            categoryId,
          },
        },
      ),
    onSuccess: refresh,
    onError: (error: ApiError) => {
      if (error.isNetwork || error.status === 409 || error.status === 404)
        return refresh();
    },
  });
}

export function useDeleteProduct(scope: ProductScope, id: string) {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({
        queryKey: productKeys.detail(scope, id),
        exact: true,
      }),
      invalidateProductInventory(client, scope),
    ]);

  return useMutation({
    mutationKey: productKeys.delete(scope, id),
    retry: false,
    mutationFn: () =>
      apiRequest<void>(productPath(scope, `/${encodeURIComponent(id)}`), {
        method: "DELETE",
      }),
    onSuccess: refresh,
    onError: (error: ApiError) => {
      if (error.isNetwork || error.status === 409 || error.status === 404)
        return refresh();
    },
  });
}

export function useUploadProductPhoto(scope: ProductScope, productId: string) {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({
      queryKey: productKeys.detail(scope, productId),
      exact: true,
    });

  return useMutation({
    mutationKey: productKeys.photo(scope, productId),
    retry: false,
    mutationFn: async (file: File) =>
      uploadPreparedProductPhoto(
        scope,
        productId,
        await prepareProductPhoto(file),
      ),
    onSuccess: refresh,
    onError: (error: ApiError) => {
      if (error.isNetwork || error.code === "PHOTO_CONFLICT") return refresh();
    },
  });
}

export async function uploadPreparedProductPhoto(
  scope: ProductScope,
  productId: string,
  jpeg: Blob,
  progress?: { uploadId?: string },
) {
  const path = `/${encodeURIComponent(productId)}`;
  let uploadId = progress?.uploadId;
  if (!uploadId) {
    const upload = await apiRequest<ProductPhotoUpload>(
      productPath(scope, `${path}/photo-upload`),
      {
        method: "POST",
      },
    );
    await putSignedPhoto(upload.uploadUrl, jpeg);
    uploadId = upload.uploadId;
    if (progress) progress.uploadId = uploadId;
  }
  await apiRequest<unknown>(productPath(scope, `${path}/photo-confirm`), {
    method: "POST",
    body: { uploadId } satisfies ProductPhotoConfirmInput,
  });
}

export async function putSignedPhoto(uploadUrl: string, jpeg: Blob) {
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: jpeg,
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Photo upload request failed",
      undefined,
      true,
    );
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      "PHOTO_UNAVAILABLE",
      "Signed photo upload failed",
    );
  }
}
