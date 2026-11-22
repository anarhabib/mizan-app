import { useEffect, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldError,
  type UseFormReturn,
} from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  maxSaleItems,
  maxSalePayments,
  salePaymentMethods,
  type CustomerContact,
  type SaleCreateInput,
  type SaleOptions,
} from "@mizan/contracts";
import { Plus, RotateCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  exchangeRatesQuery,
  suggestedExchangeRate,
} from "@/features/exchange-rates";
import { ProductSelect, productDetailQuery } from "@/features/products";
import { useWorkspace } from "@/features/workspace";
import { formatMoney } from "@/shared/lib/format";
import { MoneyText } from "@/shared/ui/MoneyText";
import { saleKeys, salePreviewQuery, type SaleScope } from "../api/queries";
import type { useSaleSubmission } from "../hooks/useSaleSubmission";
import {
  buildSalePreviewInput,
  maxTradeIns,
  saleResolver,
  type SaleFormValues,
} from "../lib/form";
import { SaleProductPicker } from "./SaleProductPicker";
import { SaleCustomerPicker } from "./SaleCustomerPicker";
import { PaymentFields } from "./PaymentFields";
import { DecimalInput, FormField } from "./SaleFields";
import { SaleTotals } from "./SaleTotals";
type Submission = ReturnType<typeof useSaleSubmission>;

function SalePriceField({
  form,
  name,
  scope,
  productId,
  currency,
  id,
  error,
  disabled,
}: {
  form: UseFormReturn<SaleFormValues, unknown, SaleCreateInput>;
  name: "saleAmount" | `items.${number}.saleAmount`;
  scope: SaleScope;
  productId: string;
  currency: string;
  id: string;
  error?: FieldError;
  disabled: boolean;
}) {
  const { t } = useTranslation("sales");
  const [edited, setEdited] = useState(false);
  const query = useQuery({
    ...productDetailQuery(scope, productId),
    select: (product) => product.estimatedSellingValue,
    retry: false,
  });
  const suggested =
    !query.isFetching && !query.isError && query.data?.currency === currency
      ? query.data.amount
      : undefined;
  const { getValues, setValue } = form;
  useEffect(() => {
    if (!disabled && !edited && suggested !== undefined && !getValues(name))
      setValue(name, suggested);
  }, [disabled, edited, getValues, name, setValue, suggested]);
  return (
    <DecimalInput
      id={id}
      name={form.register(name, {
        onChange: () => {
          setEdited(true);
        },
      })}
      label={t("amountCurrency", { label: t("fields.saleAmount"), currency })}
      error={error}
    />
  );
}

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
  const client = useQueryClient();
  const { t: customerText } = useTranslation("customers");
  const { canManageAsOwner } = useWorkspace();
  const [picking, setPicking] = useState(false);
  const [pickingCustomer, setPickingCustomer] = useState(false);
  const [customer, setCustomer] = useState<CustomerContact>();
  const customerButton = useRef<HTMLButtonElement>(null);
  const pickerHeading = useRef<HTMLDivElement>(null);
  const wasPickingCustomer = useRef(false);
  useEffect(() => {
    if (pickingCustomer) pickerHeading.current?.focus();
    else if (wasPickingCustomer.current) customerButton.current?.focus();
    wasPickingCustomer.current = pickingCustomer;
  }, [pickingCustomer]);
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
  const officialRates = useQuery({
    ...exchangeRatesQuery(scope),
    enabled: currency !== "AZN",
  });
  const reportingSuggestion = suggestedExchangeRate(
    officialRates.data,
    currency,
  );
  const form = useForm<SaleFormValues, unknown, SaleCreateInput>({
    defaultValues: {
      customerId: "",
      customerReportingRate: "",
      noPayment: false,
      saleAmount: "",
      items: [],
      tradeIns: [],
      payments: [],
    },
    mode: "onSubmit",
    // Keep inline errors in place while a submit click moves focus off an input.
    reValidateMode: "onSubmit",
    resolver: saleResolver(productId, options),
  });
  const tradeIns = useFieldArray({ control: form.control, name: "tradeIns" });
  const items = useFieldArray({ control: form.control, name: "items" });
  const payments = useFieldArray({ control: form.control, name: "payments" });
  const tradeInValues = useWatch({
    control: form.control,
    name: "tradeIns",
  });
  const saleAmountValue = useWatch({
    control: form.control,
    name: "saleAmount",
  });
  const saleItemValues = useWatch({
    control: form.control,
    name: "items",
  });
  const paymentValues =
    useWatch({ control: form.control, name: "payments" }) ?? [];
  const noPayment = useWatch({ control: form.control, name: "noPayment" });
  const customerReportingRate = useWatch({
    control: form.control,
    name: "customerReportingRate",
  });
  const [reportingRateEdited, setReportingRateEdited] = useState(false);
  const showReportingRate =
    currency !== "AZN" &&
    (Boolean(customer) || !noPayment || payments.fields.length > 0);
  const { setValue } = form;
  useEffect(() => {
    if (
      showReportingRate &&
      !disabled &&
      reportingSuggestion &&
      !customerReportingRate &&
      !reportingRateEdited
    ) {
      setValue("customerReportingRate", reportingSuggestion);
    }
  }, [
    customerReportingRate,
    disabled,
    reportingRateEdited,
    reportingSuggestion,
    setValue,
    showReportingRate,
  ]);
  const { errors } = form.formState;
  const previewInput = buildSalePreviewInput(
    {
      saleAmount: saleAmountValue,
      items: saleItemValues,
      tradeIns: tradeInValues ?? [],
      payments: paymentValues,
      noPayment,
      customerId: customer?.id,
      customerReportingRate,
    },
    options,
  );
  const previewKey = previewInput ? JSON.stringify(previewInput) : undefined;
  const [debouncedPreview, setDebouncedPreview] = useState<{
    key: string;
    input: NonNullable<typeof previewInput>;
  }>();
  useEffect(() => {
    if (!previewKey) return;
    const timeout = setTimeout(() => {
      setDebouncedPreview({
        key: previewKey,
        input: JSON.parse(previewKey) as NonNullable<typeof previewInput>,
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [previewKey]);
  const activePreview =
    debouncedPreview && debouncedPreview.key === previewKey
      ? debouncedPreview.input
      : undefined;
  const previewQuery = useQuery(salePreviewQuery(scope, activePreview));
  const pricingPreviewError =
    previewQuery.error?.code === "GOLD_PRICE_UNAVAILABLE"
      ? "errors.rateUnavailable"
      : previewQuery.error?.code === "PURITY_CONFLICT"
        ? "errors.purityUnavailable"
        : previewQuery.error?.field === "rateId"
          ? "errors.conflict"
          : null;
  const preview = activePreview ? previewQuery.data : undefined;
  const previewHasPayments =
    !payments.fields.length || !!activePreview?.payments;
  const rateOptions = rates.map((rate) => ({
    value: String(rate.purity),
    label:
      rate.amountPerGram !== null
        ? t("rateOption", {
            purity: rate.purity,
            rate: formatMoney(
              { amount: rate.amountPerGram, currency },
              i18n.resolvedLanguage,
            ),
          })
        : t("unavailableRateOption", { purity: rate.purity }),
  }));
  const tradeInError = errors.tradeIns?.root ?? errors.tradeIns;

  async function submitAction(
    action: () => ReturnType<Submission["submit"]> | undefined,
  ) {
    setMessage(undefined);
    const error = await action();
    if (error) {
      if (error.field) form.setError(error.field, { type: error.message });
      else setMessage(error.message);
    }
  }
  const submit = form.handleSubmit((payload) =>
    submitAction(() => submission.submit(payload)),
  );
  const financials = canManageAsOwner
    ? submission.confirmation?.financials
    : undefined;
  const debt = submission.confirmation?.debt;

  const confirmation = confirmOpen && (
    <div className="grid gap-4 pb-1">
      {debt && (
        <>
          <p
            id="sale-confirmation-description"
            className="text-muted-foreground"
          >
            {t("confirmDebt")}
          </p>
          <SaleTotals {...debt} />
        </>
      )}
      {(submission.confirmation?.belowCost || !debt) && (
        <p
          id={debt ? undefined : "sale-confirmation-description"}
          className="text-muted-foreground"
        >
          {t(financials ? "confirmBelowCost" : "confirmGeneric")}
        </p>
      )}
      {financials && (
        <ul className="divide-y rounded-lg border border-border bg-card">
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
          variant="secondary"
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
    <form noValidate onSubmit={submit} hidden={confirmOpen || pickingCustomer}>
      <fieldset disabled={disabled} className="grid min-w-0 gap-6">
        <SalePriceField
          form={form}
          name="saleAmount"
          scope={scope}
          productId={productId}
          currency={currency}
          disabled={disabled}
          id="sale-amount"
          error={errors.saleAmount}
        />
        {items.fields.map((item, index) => (
          <div
            className="grid gap-3 rounded-lg border border-border bg-card p-3"
            key={item.id}
          >
            <p className="font-medium wrap-anywhere">{item.label}</p>
            <SalePriceField
              form={form}
              name={`items.${index}.saleAmount`}
              scope={scope}
              productId={item.productId}
              currency={currency}
              disabled={disabled}
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
        <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
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
            const selectedPurity = tradeInValues?.[index]?.purity;
            const requiresAgreedAmount =
              rates.find(({ purity }) => String(purity) === selectedPurity)
                ?.id === null;
            return (
              <div
                className="grid gap-3 rounded-lg border border-border bg-card p-3"
                key={row.id}
              >
                <Controller
                  control={form.control}
                  name={`tradeIns.${index}.purity`}
                  render={({ field }) => (
                    <FormField
                      id={rateId}
                      label={t("fields.purity")}
                      error={error?.purity}
                    >
                      <ProductSelect
                        id={rateId}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        options={rateOptions}
                        placeholder={t("chooseRate")}
                        invalid={Boolean(error?.purity)}
                        describedBy={
                          error?.purity ? `${rateId}-error` : undefined
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
                    label: t(
                      requiresAgreedAmount
                        ? "agreedAmount"
                        : "overrideOptional",
                    ),
                    currency,
                  })}
                  id={`sale-override-${row.id}`}
                  error={error?.overrideAmount}
                  required={requiresAgreedAmount}
                  hint={
                    requiresAgreedAmount
                      ? t("errors.rateUnavailable")
                      : undefined
                  }
                />
                {activePreview && previewQuery.data?.tradeIns[index] && (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {(
                      ["rate", "calculatedValue", "acceptedValue"] as const
                    ).map((field) => {
                      const line = previewQuery.data?.tradeIns[index];
                      if (!line) return null;
                      const amount =
                        field === "rate"
                          ? line.appliedRate
                          : field === "calculatedValue"
                            ? line.calculatedValue
                            : line.acceptedValue;
                      if (amount === null) return null;
                      return (
                        <div key={field} className="min-w-0">
                          <dt className="text-xs text-muted-foreground">
                            {t(`fields.${field}`)}
                          </dt>
                          <dd className="wrap-anywhere tabular-nums">
                            <MoneyText value={{ amount, currency }} />
                            {field === "rate" && t("perGram")}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
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
          {activePreview && previewQuery.isPending && (
            <p role="status" className="text-muted-foreground">
              {t("previewLoading")}
            </p>
          )}
          {activePreview && previewQuery.isError && (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-destructive">
                {t(pricingPreviewError ?? "previewFailed")}
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 lg:min-h-9"
                onClick={() => {
                  if (pricingPreviewError)
                    void client.invalidateQueries({
                      queryKey: saleKeys.options(scope),
                      exact: true,
                    });
                  else void previewQuery.refetch();
                }}
              >
                <RotateCw aria-hidden="true" />
                {t("retryPreview")}
              </Button>
            </div>
          )}
          {rates.length > 0 && tradeIns.fields.length < maxTradeIns && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start lg:min-h-9"
              onClick={() =>
                tradeIns.append({
                  purity: "",
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
        <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
          <h3 className="font-medium">{customerText("optionalCustomer")}</h3>
          {customer && (
            <p className="wrap-anywhere">
              {customer.name} · {customer.phone}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              ref={customerButton}
              type="button"
              variant="outline"
              className="min-h-11 lg:min-h-9"
              aria-describedby={
                errors.customerId ? "sale-customer-error" : undefined
              }
              onClick={() => setPickingCustomer(true)}
            >
              {customerText(customer ? "change" : "select")}
            </Button>
            {customer && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 lg:min-h-9"
                onClick={() => {
                  setCustomer(undefined);
                  form.setValue("customerId", "");
                  form.setValue("customerReportingRate", "");
                  setReportingRateEdited(false);
                  form.clearErrors(["customerId", "customerReportingRate"]);
                  customerButton.current?.focus();
                }}
              >
                {customerText("remove")}
              </Button>
            )}
          </div>
          {errors.customerId && (
            <p
              id="sale-customer-error"
              role="alert"
              className="text-destructive"
            >
              {customerText(
                errors.customerId.type === "customerMissing"
                  ? "missing"
                  : "requiredForDebt",
              )}
            </p>
          )}
          {showReportingRate && (
            <DecimalInput
              name={form.register("customerReportingRate", {
                onChange: () => {
                  setReportingRateEdited(true);
                },
              })}
              id="sale-customer-reporting-rate"
              label={customerText("reportingRate", { currency })}
              error={errors.customerReportingRate}
              hint={
                reportingSuggestion &&
                customerReportingRate === reportingSuggestion &&
                (officialRates.data?.stale || officialRates.isError)
                  ? t("cachedExchangeRate")
                  : undefined
              }
            />
          )}
        </section>
        <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
          <h3 className="font-medium">{t("payment")}</h3>
          {!payments.fields.length && (
            <Label
              htmlFor="sale-no-payment"
              className="min-h-11 gap-3 lg:min-h-9"
            >
              <input
                id="sale-no-payment"
                type="checkbox"
                className="size-4 accent-primary"
                {...form.register("noPayment", {
                  onChange: () => form.clearErrors("customerId"),
                })}
              />
              {t("noPaymentAtCheckout")}
            </Label>
          )}
          {!noPayment && !payments.fields.length && (
            <p className="text-muted-foreground">
              {t("defaultPayment", { currency })}
            </p>
          )}
          {payments.fields.map((row, index) => (
            <div
              key={row.id}
              className="grid gap-3 rounded-lg border border-border bg-card p-3"
            >
              <PaymentFields
                scope={scope}
                values={paymentValues[index] ?? row}
                setExchangeRate={(rate) => {
                  form.setValue(`payments.${index}.exchangeRate`, rate);
                  form.clearErrors(`payments.${index}.exchangeRate`);
                }}
                selectMethod={(method) => {
                  const value = salePaymentMethods.find(
                    (option) => option === method,
                  );
                  if (value) form.setValue(`payments.${index}.method`, value);
                }}
                errors={errors.payments?.[index]}
                disabled={disabled}
                fields={{
                  currency: form.register(`payments.${index}.currency`),
                  amount: form.register(`payments.${index}.amount`),
                  exchangeRate: form.register(`payments.${index}.exchangeRate`),
                }}
              />
              {(currency !== "AZN" ||
                (paymentValues[index]?.currency ?? row.currency)
                  .trim()
                  .toUpperCase() === "AZN") &&
                preview?.payments?.[index] && (
                  <div className="text-sm text-muted-foreground">
                    {t("fields.convertedAmount")}{" "}
                    <MoneyText
                      value={{
                        amount: preview.payments[index].convertedAmount,
                        currency,
                      }}
                    />
                  </div>
                )}
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 justify-self-start lg:min-h-9"
                onClick={() => {
                  payments.remove(index);
                  form.setValue("noPayment", true);
                  form.clearErrors("payments");
                  setMessage(undefined);
                }}
              >
                <Trash2 aria-hidden="true" />
                {t("removePayment")}
              </Button>
            </div>
          ))}
          {payments.fields.length < maxSalePayments && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start lg:min-h-9"
              onClick={() => {
                payments.append({
                  method: "CASH",
                  currency,
                  amount: "",
                  exchangeRate: "",
                });
                form.setValue("noPayment", false);
                setMessage(undefined);
              }}
            >
              <Plus aria-hidden="true" />
              {t("addPayment")}
            </Button>
          )}
          {preview?.saleAmount !== undefined && (
            <SaleTotals
              total={{ amount: preview.saleAmount, currency }}
              tradeIn={{ amount: preview.tradeInTotal, currency }}
              paid={
                previewHasPayments && preview.paidAmount !== undefined
                  ? { amount: preview.paidAmount, currency }
                  : undefined
              }
              outstanding={
                previewHasPayments && preview.outstandingDebt !== undefined
                  ? { amount: preview.outstandingDebt, currency }
                  : undefined
              }
            />
          )}
          {preview?.overpayment && preview.overpayment !== "0" && (
            <p role="status" className="text-destructive">
              {t("errors.paymentExceedsBalance")}
            </p>
          )}
        </section>
        {message &&
          message !== "unknownOutcome" &&
          message !== "customerRequired" &&
          message !== "customerMissing" && (
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
      {pickingCustomer && (
        <div ref={pickerHeading} tabIndex={-1}>
          <SaleCustomerPicker
            scope={scope}
            close={() => setPickingCustomer(false)}
            select={(selected) => {
              setCustomer(selected);
              form.setValue("customerId", selected.id);
              form.clearErrors("customerId");
              setPickingCustomer(false);
            }}
          />
        </div>
      )}
      {confirmation}
    </>
  );
}
