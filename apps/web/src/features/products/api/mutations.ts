import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ProductAcquisitionInput,
  ProductCreateInput,
  ProductDetail,
  ProductPhotoConfirmInput,
  ProductPhotoUpload,
} from "@mizan/contracts";
import { ApiError, apiRequest } from "@/shared/lib/api";
import { prepareProductPhoto } from "../lib/photo";
import {
  invalidateProductInventory,
  productKeys,
  productPath,
  type ProductScope,
} from "./queries";

export function useCreateProduct(scope: ProductScope) {
  const client = useQueryClient();
  const refresh = () => invalidateProductInventory(client, scope);

  return useMutation({
    mutationKey: productKeys.create(scope),
    retry: false,
    mutationFn: (body: ProductCreateInput) =>
      apiRequest<ProductDetail>(productPath(scope), { method: "POST", body }),
    onSuccess: refresh,
    onError: (error: ApiError) => {
      if (error.isNetwork) return refresh();
    },
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
    mutationFn: ({ weight, acquisitionCostPerGram }: ProductAcquisitionInput) =>
      apiRequest<void>(
        productPath(scope, `/${encodeURIComponent(id)}/acquisition`),
        {
          method: "PATCH",
          body: { weight, acquisitionCostPerGram },
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
  const path = `/${encodeURIComponent(productId)}`;
  const refresh = () =>
    client.invalidateQueries({
      queryKey: productKeys.detail(scope, productId),
      exact: true,
    });

  return useMutation({
    mutationKey: productKeys.photo(scope, productId),
    retry: false,
    mutationFn: async (file: File) => {
      const jpeg = await prepareProductPhoto(file);
      const upload = await apiRequest<ProductPhotoUpload>(
        productPath(scope, `${path}/photo-upload`),
        {
          method: "POST",
        },
      );
      await putSignedPhoto(upload.uploadUrl, jpeg);
      await apiRequest<unknown>(productPath(scope, `${path}/photo-confirm`), {
        method: "POST",
        body: { uploadId: upload.uploadId } satisfies ProductPhotoConfirmInput,
      });
    },
    onSuccess: refresh,
    onError: (error: ApiError) => {
      if (error.isNetwork || error.code === "PHOTO_CONFLICT") return refresh();
    },
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
