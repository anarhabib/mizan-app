import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldError,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { maxSaleItems, type SaleCreateInput } from "@mizan/contracts";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductSelect } from "@/features/products";
import { useWorkspace } from "@/features/workspace";
import { formatMoney } from "@/shared/lib/format";
import { MoneyText } from "@/shared/ui/MoneyText";
import type { SaleOptions, SaleScope } from "../api/queries";
import type { useSaleSubmission } from "../hooks/useSaleSubmission";
import { maxTradeIns, saleResolver, type SaleFormValues } from "../lib/form";
import { SaleProductPicker } from "./SaleProductPicker";

const currencies = Intl.supportedValuesOf("currency").map((value) => ({
  value,
  label: value,
}));
type Submission = ReturnType<typeof useSaleSubmission>;

export function SaleForm({
  productId,
  scope,
  options,
  disabled,
  submission,
}: {
  productId: string;
  scope: SaleScope;
  options: SaleOptions;
  disabled: boolean;
  submission: Submission;
}) {
  const { t, i18n } = useTranslation("sales");
  const { canManageAsOwner } = useWorkspace();
  const [picking, setPicking] = useState(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const confirmationToken = submission.confirmation?.token;
  const confirmOpen = Boolean(confirmationToken);
  const previousConfirmation = useRef<string>(undefined);
  useEffect(() => {
    if (confirmationToken) cancelButton.current?.focus();
    else if (previousConfirmation.current) saveButton.current?.focus();
    previousConfirmation.current = confirmationToken;
  }, [confirmationToken]);
  const [message, setMessage] =
    useState<
      NonNullable<Awaited<ReturnType<Submission["submit"]>>>["message"]
    >();
  const { currency, rates } = options;
  const form = useForm<SaleFormValues, unknown, SaleCreateInput>({
    defaultValues: {
      saleAmount: "",
      items: [],
      tradeIns: [],
      includePayment: false,
      payment: { currency, amount: "", exchangeRate: "" },
    },
    mode: "onSubmit",
    // Keep inline errors in place while a submit click moves focus off an input.
    reValidateMode: "onSubmit",
    resolver: saleResolver(productId, options),
  });
  const tradeIns = useFieldArray({ control: form.control, name: "tradeIns" });
  const items = useFieldArray({ control: form.control, name: "items" });
  const paymentEnabled = useWatch({
    control: form.control,
    name: "includePayment",
  });
  const paymentCurrency = useWatch({
    control: form.control,
    name: "payment.currency",
  });
  const { errors } = form.formState;
  const rateOptions = rates.map((rate) => ({
    value: rate.id,
    label: t("rateOption", {
      purity: rate.purity,
      rate: formatMoney(
        { amount: rate.amountPerGram, currency },
        i18n.resolvedLanguage,
      ),
    }),
  }));
  const tradeInError = errors.tradeIns?.root ?? errors.tradeIns;

  async function submitAction(
    action: () => ReturnType<Submission["submit"]> | undefined,
  ) {
    setMessage(undefined);
    const error = await action();
    if (error) {
      if (error.field) form.setError(error.field, { type: error.message });
      if (!error.field) setMessage(error.message);
    }
  }
  const submit = form.handleSubmit((payload) =>
    submitAction(() => submission.submit(payload)),
  );
  const financials = canManageAsOwner
    ? submission.confirmation?.financials
    : undefined;

  const confirmation = confirmOpen && (
    <div className="grid gap-4 pb-1">
      <p id="sale-confirmation-description" className="text-muted-foreground">
        {t(financials ? "confirmBelowCost" : "confirmGeneric")}
      </p>
      {financials && (
        <ul className="divide-y rounded-lg border">
          {financials.losses.map((loss) => (
            <li key={loss.productId} className="grid gap-2 p-3">
              <p className="font-medium wrap-anywhere">{loss.code}</p>
              <dl className="grid grid-cols-2 gap-3">
                {(
                  ["acquisitionCost", "saleAmount", "expectedLoss"] as const
                ).map((field) => (
                  <div key={field} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {t(`fields.${field}`)}
                    </dt>
                    <dd
                      className={
                        field === "expectedLoss"
                          ? "wrap-anywhere text-destructive"
                          : "wrap-anywhere"
                      }
                    >
                      <MoneyText
                        value={{
                          amount: loss[field],
                          currency: financials.currency,
                        }}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          ref={cancelButton}
          type="button"
          variant="outline"
          disabled={submission.busy}
          className="min-h-11 lg:min-h-9"
          onClick={submission.cancelConfirmation}
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          disabled={submission.busy}
          className="min-h-11 lg:min-h-9"
          onClick={() => void submitAction(submission.confirm)}
        >
          {t(submission.busy ? "saving" : "confirmSale")}
        </Button>
      </div>
    </div>
  );
  const formContent = (
    <form noValidate onSubmit={submit} hidden={confirmOpen}>
      <fieldset disabled={disabled} className="grid min-w-0 gap-6">
        <DecimalInput
          name={form.register("saleAmount")}
          label={t("amountCurrency", {
            label: t("fields.saleAmount"),
            currency,
          })}
          id="sale-amount"
          error={errors.saleAmount}
        />
        {items.fields.map((item, index) => (
          <div className="grid gap-3 rounded-lg border p-3" key={item.id}>
            <p className="font-medium wrap-anywhere">{item.label}</p>
            <DecimalInput
              name={form.register(`items.${index}.saleAmount`)}
              label={t("amountCurrency", {
                label: t("fields.saleAmount"),
                currency,
              })}
              id={`sale-item-amount-${item.id}`}
              error={errors.items?.[index]?.saleAmount}
            />
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 justify-self-start lg:min-h-9"
              onClick={() => items.remove(index)}
            >
              <Trash2 aria-hidden="true" />
              {t("removeProduct")}
            </Button>
          </div>
        ))}
        {picking ? (
          <SaleProductPicker
            scope={scope}
            excluded={[
              productId,
              ...items.fields.map((item) => item.productId),
            ]}
            close={() => setPicking(false)}
            select={(product) => {
              items.append(
                {
                  productId: product.id,
                  label: `${product.code} · ${product.name}`,
                  saleAmount: "",
                },
                { focusName: `items.${items.fields.length}.saleAmount` },
              );
              setPicking(false);
            }}
          />
        ) : (
          items.fields.length + 1 < maxSaleItems && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start lg:min-h-9"
              onClick={() => setPicking(true)}
            >
              <Plus aria-hidden="true" />
              {t("addProduct")}
            </Button>
          )
        )}
        <section className="grid gap-3 border-t pt-4">
          <h3 className="font-medium">{t("tradeIns")}</h3>
          {!rates.length && (
            <p className="text-muted-foreground">{t("noRates")}</p>
          )}
          {tradeInError?.type && (
            <p role="alert" className="text-destructive">
              {t("invalidTradeIns")}
            </p>
          )}
          {tradeIns.fields.map((row, index) => {
            const error = errors.tradeIns?.[index];
            const rateId = `sale-rate-${row.id}`;
            return (
              <div className="grid gap-3 rounded-lg border p-3" key={row.id}>
                <Controller
                  control={form.control}
                  name={`tradeIns.${index}.rateId`}
                  render={({ field }) => (
                    <FormField
                      id={rateId}
                      label={t("fields.purityRate")}
                      error={error?.rateId}
                    >
                      <ProductSelect
                        id={rateId}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        options={rateOptions}
                        placeholder={t("chooseRate")}
                        invalid={Boolean(error?.rateId)}
                        describedBy={
                          error?.rateId ? `${rateId}-error` : undefined
                        }
                        disabled={disabled}
                      />
                    </FormField>
                  )}
                />
                <DecimalInput
                  name={form.register(`tradeIns.${index}.weight`)}
                  label={t("fields.weightGrams")}
                  id={`sale-weight-${row.id}`}
                  error={error?.weight}
                />
                <DecimalInput
                  name={form.register(`tradeIns.${index}.overrideAmount`)}
                  label={t("amountCurrency", {
                    label: t("overrideOptional"),
                    currency,
                  })}
                  id={`sale-override-${row.id}`}
                  error={error?.overrideAmount}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 justify-self-start lg:min-h-9"
                  onClick={() => {
                    tradeIns.remove(index);
                    form.clearErrors("tradeIns");
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  {t("removeTradeIn")}
                </Button>
              </div>
            );
          })}
          {rates.length > 0 && tradeIns.fields.length < maxTradeIns && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start lg:min-h-9"
              onClick={() =>
                tradeIns.append({
                  rateId: "",
                  weight: "",
                  overrideAmount: "",
                })
              }
            >
              <Plus aria-hidden="true" />
              {t("addTradeIn")}
            </Button>
          )}
        </section>
        <section className="grid gap-3 border-t pt-4">
          <h3 className="font-medium">{t("payment")}</h3>
          <p className="text-muted-foreground">
            {paymentEnabled
              ? t("paymentCoverage")
              : t("defaultPayment", { currency })}
          </p>
          <Button
            type="button"
            variant="outline"
            aria-expanded={paymentEnabled}
            className="min-h-11 justify-self-start lg:min-h-9"
            onClick={() => {
              if (!paymentEnabled) form.setValue("payment.currency", currency);
              form.setValue("includePayment", !paymentEnabled);
              form.clearErrors("payment");
              setMessage(undefined);
            }}
          >
            {t(paymentEnabled ? "removePayment" : "addPayment")}
          </Button>
          {paymentEnabled && (
            <>
              <Controller
                control={form.control}
                name="payment.currency"
                render={({ field }) => (
                  <FormField
                    id="sale-payment-currency"
                    label={t("fields.paymentCurrency")}
                    error={errors.payment?.currency}
                  >
                    <ProductSelect
                      id="sale-payment-currency"
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        form.clearErrors("payment");
                      }}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      options={currencies}
                      invalid={Boolean(errors.payment?.currency)}
                      describedBy={
                        errors.payment?.currency
                          ? "sale-payment-currency-error"
                          : undefined
                      }
                      disabled={disabled}
                    />
                  </FormField>
                )}
              />
              <DecimalInput
                name={form.register("payment.amount")}
                label={t("amountCurrency", {
                  label: t("fields.paymentAmount"),
                  currency: paymentCurrency,
                })}
                id="sale-payment-amount"
                error={errors.payment?.amount}
              />
              {paymentCurrency !== currency && (
                <DecimalInput
                  name={form.register("payment.exchangeRate")}
                  label={t("fields.exchangeRate")}
                  id="sale-exchange-rate"
                  error={errors.payment?.exchangeRate}
                  hint={t("exchangeRateHint", { paymentCurrency, currency })}
                />
              )}
            </>
          )}
        </section>
        {message && message !== "unknownOutcome" && (
          <p role="alert" className="text-destructive">
            {t(`errors.${message}`)}
          </p>
        )}
        {submission.checkedInStock && !submission.busy && (
          <p role="status">{t("checkedInStock")}</p>
        )}
        <Button
          ref={saveButton}
          type="submit"
          className="min-h-11 justify-self-start lg:min-h-9"
          disabled={form.formState.isSubmitting || disabled}
        >
          {t(submission.busy ? "saving" : "save")}
        </Button>
      </fieldset>
    </form>
  );
  return (
    <>
      {formContent}
      {confirmation}
    </>
  );
}

function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: FieldError;
  hint?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("sales");
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error.type === "paymentTooLow"
            ? t("errors.paymentTooLow")
            : t("invalidField")}
        </p>
      )}
    </div>
  );
}

function DecimalInput({
  name,
  label,
  id,
  error,
  hint,
}: {
  name: UseFormRegisterReturn;
  label: string;
  id: string;
  error?: FieldError;
  hint?: string;
}) {
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className="min-h-11 tabular-nums lg:min-h-9"
        {...name}
      />
    </FormField>
  );
}
