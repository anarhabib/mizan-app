import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ProductDetail,
  SaleCreateInput,
  SaleResult,
} from "@mizan/contracts";
import {
  cacheSoldProduct,
  invalidateProductInventory,
  productDetailQuery,
  productKeys,
} from "@/features/products";
import { apiRequest, ApiError } from "@/shared/lib/api";
import { saleKeys, salePath, type SaleScope } from "../api/queries";
import { saleAttempt, type SaleAttempt } from "../lib/attempt";
import { saleError } from "../lib/form";

export function useSaleSubmission(scope: SaleScope, productId: string) {
  const client = useQueryClient();
  const attempt = useRef<SaleAttempt>(undefined);
  const locked = useRef(false);
  const requiresCheck = useRef(false);
  const [busy, setBusy] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [checkedInStock, setCheckedInStock] = useState(false);
  const [recoveredId, setRecoveredId] = useState<string>();

  async function refreshInventory(sale: NonNullable<ProductDetail["sale"]>) {
    await cacheSoldProduct(client, scope, productId, sale);
    const lists = client
      .getQueryCache()
      .findAll({ queryKey: saleKeys.lists(scope) });
    void Promise.all([
      ...lists.map(({ queryKey }) =>
        client.invalidateQueries({ queryKey, exact: true }),
      ),
      client.invalidateQueries({
        queryKey: productKeys.detail(scope, productId),
        exact: true,
      }),
      invalidateProductInventory(client, scope),
    ]);
  }

  const mutation = useMutation({
    mutationKey: saleKeys.create(scope),
    retry: false,
    networkMode: "always",
    mutationFn: async ({ key, payload }: SaleAttempt) => {
      const result = await apiRequest<SaleResult>(salePath(scope), {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: payload,
        signal: AbortSignal.timeout(30_000),
      });
      if (!result?.id)
        throw new ApiError(201, "INVALID_RESPONSE", "Missing sale result");
      return result;
    },
    onSuccess: async (result) => {
      attempt.current = undefined;
      client.setQueryData(saleKeys.detail(scope, result.id), result);
      await refreshInventory({
        id: result.id,
        createdAt: result.createdAt,
        total: { amount: result.saleAmount, currency: result.currency },
      });
    },
  });

  async function verifyProduct() {
    requiresCheck.current = true;
    setNeedsCheck(true);
    setCheckedInStock(false);
    try {
      const query = productDetailQuery(scope, productId);
      await client.cancelQueries({ queryKey: query.queryKey, exact: true });
      const product = await client.fetchQuery({
        ...query,
        staleTime: 0,
        retry: false,
        networkMode: "always",
      });
      if (product.status === "SOLD") {
        if (product.sale) {
          setRecoveredId(product.sale.id);
          await refreshInventory(product.sale);
        }
        return;
      }
      if (product.status === "IN_STOCK") {
        requiresCheck.current = false;
        setNeedsCheck(false);
        setCheckedInStock(true);
      }
    } catch {
      // A failed check leaves submission locked until a fresh read succeeds.
    }
  }

  async function checkAgain() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await verifyProduct();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function submit(payload: SaleCreateInput) {
    if (locked.current || requiresCheck.current || mutation.data) return;
    locked.current = true;
    setBusy(true);
    setCheckedInStock(false);
    try {
      const next = saleAttempt(attempt.current, payload);
      attempt.current = next;
      await mutation.mutateAsync(next);
    } catch (error) {
      const mapped = saleError(
        error instanceof ApiError
          ? error
          : new ApiError(0, "UNKNOWN", "Sale failed"),
        payload.tradeIns?.length ?? 0,
      );
      if ("check" in mapped) await verifyProduct();
      if ("refresh" in mapped && mapped.refresh) {
        await client.invalidateQueries({
          queryKey: saleKeys.options(scope),
          exact: true,
        });
      }
      return mapped;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return {
    busy,
    needsCheck,
    checkedInStock,
    resultId: mutation.data?.id,
    recoveredId,
    submit,
    checkAgain,
  };
}
