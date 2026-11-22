import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import {
  salePaymentMethods,
  type MoneyInput,
  type SalePaymentInput,
  type SaleResult,
} from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { invalidateCustomers } from "@/features/customers";
import { invalidateProductInventory, productKeys } from "@/features/products";
import { apiRequest, ApiError } from "@/shared/lib/api";
import { MoneyText } from "@/shared/ui/MoneyText";
import { saleKeys, salePath, type SaleScope } from "../api/queries";
import { buildPayment, saleError, type PaymentValues } from "../lib/form";
import { PaymentFields } from "./PaymentFields";

type Attempt = { key: string; payload: SalePaymentInput };

export function SaleRepayment({
  scope,
  saleId,
  customerId,
  outstanding,
}: {
  scope: SaleScope;
  saleId: string;
  customerId: string;
  outstanding: MoneyInput;
}) {
  const { t } = useTranslation("sales");
  const [open, setOpen] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<Attempt>(undefined);
  const locked = useRef(false);
  const client = useQueryClient();
  const form = useForm<PaymentValues>({
    defaultValues: {
      method: "CASH",
      currency: outstanding.currency,
      amount: "",
      exchangeRate: "",
    },
  });
  const currency = useWatch({ control: form.control, name: "currency" });
  const method = useWatch({ control: form.control, name: "method" });
  const detailKey = saleKeys.detail(scope, saleId);
  const mutation = useMutation({
    mutationKey: [...detailKey, "payments"],
    retry: false,
    networkMode: "always",
    mutationFn: async ({ key, payload }: Attempt) => {
      const receipt = await apiRequest<SaleResult>(
        salePath(scope, `/${encodeURIComponent(saleId)}/payments`),
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: payload,
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (
        receipt?.id !== saleId ||
        !Array.isArray(receipt.items) ||
        !Array.isArray(receipt.payments)
      )
        throw new ApiError(201, "INVALID_RESPONSE", "Missing repayment result");
      return receipt;
    },
    onSuccess: async (receipt) => {
      const salesLists = client
        .getQueryCache()
        .findAll({ queryKey: saleKeys.lists(scope) });
      const details = receipt.items.map(({ product }) =>
        productKeys.detail(scope, product.id),
      );
      await Promise.all([
        invalidateCustomers(client, scope, customerId),
        invalidateProductInventory(client, scope),
        ...[
          detailKey,
          ...details,
          ...salesLists.map(({ queryKey }) => queryKey),
        ].map((queryKey) =>
          client.invalidateQueries({ queryKey, exact: true }),
        ),
      ]);
    },
  });

  async function send(next: Attempt) {
    if (locked.current) return;
    locked.current = true;
    attempt.current = next;
    try {
      await mutation.mutateAsync(next);
      form.reset();
      setOpen(false);
      setUncertain(false);
      attempt.current = undefined;
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped = saleError(error, 0);
        setUncertain("check" in mapped);
        if (
          error.code === "SALE_PAYMENT_EXCEEDS_BALANCE" ||
          error.code === "SALE_PAYMENT_NOT_DUE"
        ) {
          await Promise.all([
            client.invalidateQueries({ queryKey: detailKey, exact: true }),
            invalidateCustomers(client, scope, customerId),
          ]);
        }
      }
    } finally {
      locked.current = false;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    void form.handleSubmit(async (values) => {
      if (uncertain && attempt.current) return send(attempt.current);
      const result = buildPayment(values);
      if ("field" in result) {
        form.setError(result.field, { type: "validate" });
        return;
      }
      await send({ key: crypto.randomUUID(), payload: result.input });
    })(event);
  }
  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="min-h-11 justify-self-start lg:min-h-9"
        onClick={() => setOpen(true)}
      >
        {t("repay")}
      </Button>
    );
  }

  const error =
    mutation.error instanceof ApiError
      ? saleError(mutation.error, 0)
      : undefined;
  const pending = mutation.isPending || form.formState.isSubmitting;
  return (
    <form
      noValidate
      onSubmit={submit}
      className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3"
    >
      <p className="font-medium">
        {t("fields.outstandingDebt")} <MoneyText value={outstanding} />
      </p>
      <fieldset disabled={pending || uncertain} className="min-w-0">
        <PaymentFields
          currency={currency}
          method={method}
          selectMethod={(value) => {
            const option = salePaymentMethods.find((item) => item === value);
            if (option) form.setValue("method", option);
          }}
          disabled={pending || uncertain}
          errors={form.formState.errors}
          fields={{
            currency: form.register("currency"),
            amount: form.register("amount"),
            exchangeRate: form.register("exchangeRate"),
          }}
        />
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {uncertain
            ? t("repaymentUnknown")
            : error.message === "customerRequired" ||
                error.message === "customerMissing"
              ? t("errors.generic")
              : t(`errors.${error.message}`)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={pending}
          className="min-h-11 lg:min-h-9"
        >
          {t(
            pending ? "saving" : uncertain ? "retryRepayment" : "saveRepayment",
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending || uncertain}
          className="min-h-11 lg:min-h-9"
          onClick={() => {
            form.reset();
            mutation.reset();
            setOpen(false);
          }}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
