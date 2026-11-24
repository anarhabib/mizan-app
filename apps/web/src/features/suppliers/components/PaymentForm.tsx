import { useId, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  parseSupplierPayment,
  supplierPaymentMethods,
  type PurchaseSummary,
  type SupplierPaymentInput,
} from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PendingButton } from "@/shared/ui/PendingButton";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { useRecordPayment, type SupplierScope } from "../api/queries";
import { todayInBaku } from "../lib/financial";
import { useFinancialAttempt } from "../lib/useFinancialAttempt";
import { controlClass, Payable, WriteError } from "./ledger";

export function PaymentForm({
  scope,
  purchase,
  close,
}: {
  scope: SupplierScope;
  purchase: PurchaseSummary;
  close: () => void;
}) {
  const { t } = useTranslation(["suppliers", "sales"]);
  const id = useId();
  const [error, setError] = useState<unknown>();
  const [invalid, setInvalid] = useState<string>();
  const mutation = useRecordPayment(scope, purchase.supplier.id, purchase.id);
  const send = useFinancialAttempt<SupplierPaymentInput>(
    scope,
    `payment/${purchase.id}`,
  );
  const form = useForm<SupplierPaymentInput>({
    defaultValues: {
      amount: "",
      method: "CASH",
      currency: purchase.total.currency,
      note: "",
      referenceNumber: "",
      paymentDate: [todayInBaku(), purchase.purchaseDate].sort()[1],
    },
  });
  const busy = mutation.isPending || form.formState.isSubmitting;
  return (
    <form
      noValidate
      aria-busy={busy}
      className="grid gap-4 rounded-lg border bg-card p-4"
      onSubmit={form.handleSubmit(async (body) => {
        if (mutation.isPending) return;
        setError(undefined);
        setInvalid(undefined);
        const parsed = parseSupplierPayment(body);
        if ("field" in parsed) {
          setInvalid(parsed.field);
          return;
        }
        if (parsed.input.paymentDate < purchase.purchaseDate) {
          setInvalid("paymentDate");
          return;
        }
        try {
          await send(parsed.input, mutation.mutateAsync);
          toast.success(t("paymentSaved"));
          close();
        } catch (cause) {
          setError(cause);
        }
      })}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p>
          {t("outstanding")}{" "}
          <strong>
            <Payable value={purchase.outstanding} />
          </strong>
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={busy || purchase.status === "PAID"}
          className={controlClass}
          onClick={() =>
            form.setValue("amount", purchase.outstanding.amount, {
              shouldDirty: true,
            })
          }
        >
          {t("useFullBalance")}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["amount", "text", 25],
            ["paymentDate", "date", undefined],
            ["referenceNumber", "text", 120],
          ] as const
        ).map(([field, type, maxLength]) => (
          <div key={field} className="grid min-w-0 gap-2">
            <Label htmlFor={id + field}>
              {field === "amount"
                ? t("paymentAmount", { currency: purchase.total.currency })
                : t(field)}
            </Label>
            <Input
              id={id + field}
              type={type}
              inputMode={field === "amount" ? "decimal" : undefined}
              autoFocus={field === "amount"}
              maxLength={maxLength}
              min={field === "paymentDate" ? purchase.purchaseDate : undefined}
              className={controlClass}
              aria-invalid={invalid === field}
              readOnly={busy}
              {...form.register(field)}
            />
          </div>
        ))}
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={id + "method"}>{t("method")}</Label>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <OptionSelect
                id={id + "method"}
                value={field.value}
                onChange={field.onChange}
                disabled={busy}
                options={supplierPaymentMethods.map((value) => ({
                  value,
                  label: t(`methods.${value}`, { ns: "sales" }),
                }))}
              />
            )}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id + "note"}>{t("fields.note")}</Label>
        <Textarea
          id={id + "note"}
          readOnly={busy}
          maxLength={1000}
          {...form.register("note")}
        />
      </div>
      {invalid && (
        <p role="alert" className="text-destructive">
          {t(
            invalid === "paymentDate"
              ? "invalidPaymentDate"
              : invalid === "amount"
                ? "invalidAmount"
                : "paymentError",
          )}
        </p>
      )}
      <WriteError error={error} replayable />
      <div className="flex flex-wrap gap-2">
        <PendingButton type="submit" pending={busy} className={controlClass}>
          {t("recordPayment")}
        </PendingButton>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className={controlClass}
          onClick={close}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
