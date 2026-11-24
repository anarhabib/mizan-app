import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateCustomers } from "@/features/customers";
import { refreshSupplierProductStatus } from "@/features/suppliers";
import type {
  ProductDetail,
  SaleConfirmation,
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
import {
  saleDetailQuery,
  saleKeys,
  salePath,
  type SaleScope,
} from "../api/queries";
import { saleAttempt, type SaleAttempt } from "../lib/attempt";
import { saleError } from "../lib/form";

export function useSaleSubmission(scope: SaleScope, productId: string) {
  const client = useQueryClient();
  const { t } = useTranslation("sales");
  const attempt = useRef<SaleAttempt>(undefined);
  const locked = useRef(false);
  const requiresCheck = useRef(false);
  const [busy, setBusy] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [checkedInStock, setCheckedInStock] = useState(false);
  const [recoveredId, setRecoveredId] = useState<string>();
  const [confirmation, setConfirmation] = useState<SaleConfirmation>();

  async function refreshInventory(
    sold: {
      id: string;
      sale: NonNullable<ProductDetail["sale"]>;
      hasOutstandingDebt?: boolean;
    }[],
  ) {
    for (const { id, sale, hasOutstandingDebt } of sold)
      await cacheSoldProduct(client, scope, id, sale, hasOutstandingDebt);
    const lists = client
      .getQueryCache()
      .findAll({ queryKey: saleKeys.lists(scope) });
    void Promise.all([
      ...lists.map(({ queryKey }) =>
        client.invalidateQueries({ queryKey, exact: true }),
      ),
      ...sold.map(({ id }) =>
        client.invalidateQueries({
          queryKey: productKeys.detail(scope, id),
          exact: true,
        }),
      ),
      invalidateProductInventory(client, scope),
      refreshSupplierProductStatus(client, scope),
    ]);
  }

  function refreshReceiptInventory(result: SaleResult) {
    void client.invalidateQueries({
      queryKey: saleKeys.detail(scope, result.id),
      exact: true,
    });
    if (result.customerId)
      void invalidateCustomers(client, scope, result.customerId);
    return refreshInventory(
      result.items.map(({ product, saleAmount }) => ({
        id: product.id,
        hasOutstandingDebt: result.paymentStatus !== "PAID",
        sale: {
          id: result.id,
          createdAt: result.createdAt,
          total: { amount: saleAmount, currency: result.currency },
        },
      })),
    );
  }

  const mutation = useMutation({
    mutationKey: saleKeys.create(scope),
    retry: false,
    networkMode: "always",
    mutationFn: async ({
      key,
      payload,
      token,
    }: SaleAttempt & { token?: string }) => {
      const result = await apiRequest<SaleResult>(salePath(scope), {
        method: "POST",
        headers: {
          "Idempotency-Key": key,
          ...(token && { "Sale-Confirmation": token }),
        },
        body: payload,
        signal: AbortSignal.timeout(30_000),
      });
      if (!result?.id || !Array.isArray(result.items) || !result.items.length)
        throw new ApiError(201, "INVALID_RESPONSE", "Missing sale result");
      return result;
    },
    onSuccess: async (result) => {
      attempt.current = undefined;
      setConfirmation(undefined);
      client.setQueryData(saleKeys.detail(scope, result.id), result);
      await refreshReceiptInventory(result);
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
          if (attempt.current?.payload.items) {
            try {
              const result = await client.fetchQuery({
                ...saleDetailQuery(scope, product.sale.id),
                networkMode: "always",
                retry: false,
              });
              await refreshReceiptInventory(result);
              return;
            } catch {
              // The product lookup still identifies the receipt.
            }
          }
          await refreshInventory([
            {
              id: productId,
              sale: product.sale,
              hasOutstandingDebt: product.hasOutstandingDebt,
            },
          ]);
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

  async function submit(payload: SaleCreateInput, token?: string) {
    if (locked.current || requiresCheck.current || mutation.data) return;
    locked.current = true;
    setBusy(true);
    setCheckedInStock(false);
    try {
      const next = saleAttempt(attempt.current, payload);
      attempt.current = next;
      await mutation.mutateAsync({ ...next, token });
      toast.success(
        t(payload.tradeIns?.length ? "completedWithTradeIn" : "completed"),
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "SALE_CONFIRMATION_REQUIRED" &&
        error.confirmation &&
        typeof error.confirmation === "object" &&
        "token" in error.confirmation &&
        typeof error.confirmation.token === "string"
      ) {
        setConfirmation(error.confirmation as SaleConfirmation);
        return;
      }
      const mapped = saleError(
        error instanceof ApiError
          ? error
          : new ApiError(0, "UNKNOWN", "Sale failed"),
        payload.tradeIns?.length ?? 0,
      );
      setConfirmation(undefined);
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
    confirmation,
    cancelConfirmation: () => setConfirmation(undefined),
    confirm: () => {
      if (confirmation && attempt.current)
        return submit(attempt.current.payload, confirmation.token);
    },
    submit,
    checkAgain,
  };
}
