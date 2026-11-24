import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
  type JewelrySetProduct,
  type SaleJewelrySetSelection,
  type SaleCreateInput,
  type SaleOptions,
} from "@mizan/contracts";
import { Plus, RotateCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WeightText } from "@/shared/ui/WeightText";
import {
  hasSeparateSellingPrice,
  initialProductSaleAmount,
  isMetalOnlySuggestion,
  suggestedItemAmount,
  validGramRate,
} from "../lib/item-pricing";
import { Label } from "@/components/ui/label";
import {
  exchangeRatesQuery,
  suggestedExchangeRate,
} from "@/features/exchange-rates";
import { productDetailQuery, ProductPicker } from "@/features/products";
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
  component,
  currency,
  retailRates,
  id,
  error,
  disabled,
}: {
  form: UseFormReturn<SaleFormValues, unknown, SaleCreateInput>;
  name: "saleAmount" | `items.${number}.saleAmount`;
  scope: SaleScope;
  productId: string;
  component?: JewelrySetProduct;
  currency: string;
  retailRates: SaleOptions["retailRates"];
  id: string;
  error?: FieldError;
  disabled: boolean;
}) {
  const { t } = useTranslation("sales");
  const [enteredRate, setEnteredRate] = useState<string>();
  const [finalOverridden, setFinalOverridden] = useState(false);
  const [useMetalSuggestion, setUseMetalSuggestion] = useState(false);
  const productQuery = useQuery({
    ...productDetailQuery(scope, productId),
    enabled: !component,
  });
  const product = component ?? productQuery.data;
  const weight = product?.netGoldWeight;
  const eligible = Boolean(
    weight && suggestedItemAmount("0", weight, currency) !== undefined,
  );
  const metalOnly = isMetalOnlySuggestion(product);
  const fullPriceIsSeparate = hasSeparateSellingPrice(product);
  const fixedPrice = product?.fixedSellingPrice;
  const fixedInCurrency =
    fixedPrice?.currency === currency ? fixedPrice : undefined;
  const storeRate = eligible
    ? retailRates?.find(({ purity }) => purity === product?.purity)
        ?.amountPerGram
    : undefined;
  if (!disabled && enteredRate === undefined && storeRate !== undefined)
    setEnteredRate(storeRate);
  const appliedRate = enteredRate ?? storeRate ?? "";
  const suggestion =
    eligible && weight
      ? suggestedItemAmount(appliedRate, weight, currency)
      : undefined;
  const initialAmount = initialProductSaleAmount(product, currency, suggestion);
  const { getValues, setValue } = form;

  useEffect(() => {
    if (
      !disabled &&
      !finalOverridden &&
      initialAmount !== undefined &&
      !getValues(name)
    )
      setValue(name, initialAmount);
  }, [disabled, finalOverridden, initialAmount, getValues, name, setValue]);

  function changeRate(rate: string) {
    setEnteredRate(rate);
    if (
      !weight ||
      finalOverridden ||
      fullPriceIsSeparate ||
      (metalOnly && !useMetalSuggestion)
    )
      return;
    setValue(name, suggestedItemAmount(rate, weight, currency) ?? "", {
      shouldDirty: true,
    });
  }

  return (
    <div className="grid min-w-0 gap-3">
      {product && (
        <div className="text-sm wrap-anywhere">
          {(component || name !== "saleAmount") && (
            <p className="font-medium">
              {product.code} · {product.name}
            </p>
          )}
          <p className="text-muted-foreground">
            {t("itemPricing.recordedWeight")}{" "}
            <WeightText value={product.weight} /> · {t("itemPricing.purity")}{" "}
            {product.purity}
          </p>
          {weight && (
            <p className="text-muted-foreground">
              {t("itemPricing.netWeight")} <WeightText value={weight} />
            </p>
          )}
        </div>
      )}
      {fixedPrice && (
        <p className="text-sm">
          {t("itemPricing.fixedPrice")} <MoneyText value={fixedPrice} />
        </p>
      )}
      {fixedPrice && !fixedInCurrency && (
        <p className="text-xs text-muted-foreground">
          {t("itemPricing.fixedCurrencyMismatch")}
        </p>
      )}
      {(component || !productQuery.isPending) &&
        !fixedInCurrency &&
        (!eligible || storeRate === undefined) && (
          <p className="text-xs text-muted-foreground">
            {t(eligible ? "itemPricing.noRate" : "itemPricing.noWeight")}
          </p>
        )}
      {eligible && (
        <>
          {storeRate !== undefined && (
            <p className="text-sm">
              {t("itemPricing.storeRate")}{" "}
              <MoneyText value={{ amount: storeRate, currency }} />
              {t("perGram")}
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor={id + "-gram"}>
              {t("amountCurrency", {
                label: t("itemPricing.gramRate"),
                currency,
              })}
            </Label>
            <Input
              id={id + "-gram"}
              inputMode="decimal"
              value={appliedRate}
              maxLength={33}
              aria-invalid={appliedRate !== "" && !validGramRate(appliedRate)}
              aria-describedby={
                appliedRate !== "" && !validGramRate(appliedRate)
                  ? id + "-gram-error"
                  : undefined
              }
              className="min-h-11 tabular-nums lg:min-h-9"
              onChange={(event) =>
                changeRate(event.target.value.trim().replace(",", "."))
              }
            />
            {appliedRate !== "" && !validGramRate(appliedRate) && (
              <p id={id + "-gram-error"} className="text-xs text-destructive">
                {t("invalidField")}
              </p>
            )}
          </div>
          {suggestion !== undefined && (
            <p className="text-sm">
              {t(
                metalOnly
                  ? "itemPricing.calculatedMetal"
                  : "itemPricing.calculated",
              )}{" "}
              <MoneyText value={{ amount: suggestion, currency }} />
            </p>
          )}
          {metalOnly && (
            <p className="text-xs text-muted-foreground">
              {t("itemPricing.metalOnly")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {storeRate !== undefined && storeRate !== appliedRate && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 lg:min-h-9"
                onClick={() => changeRate(storeRate)}
              >
                {t("itemPricing.restoreRate")}
              </Button>
            )}
            {!fullPriceIsSeparate &&
              suggestion !== undefined &&
              (finalOverridden || (metalOnly && !useMetalSuggestion)) && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 lg:min-h-9"
                  onClick={() => {
                    setFinalOverridden(false);
                    setUseMetalSuggestion(true);
                    setValue(name, suggestion, { shouldDirty: true });
                  }}
                >
                  {t("itemPricing.useSuggestion")}
                </Button>
              )}
          </div>
        </>
      )}
      {fixedInCurrency && finalOverridden && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 justify-self-start lg:min-h-9"
          onClick={() => {
            setFinalOverridden(false);
            setValue(name, fixedInCurrency.amount, { shouldDirty: true });
          }}
        >
          {t("itemPricing.useFixed")}
        </Button>
      )}
      <DecimalInput
        id={id}
        name={form.register(name, { onChange: () => setFinalOverridden(true) })}
        label={t("amountCurrency", {
          label: t("itemPricing.finalAmount"),
          currency,
        })}
        error={error}
      />
    </div>
  );
}

export function SaleForm({
  productId,
  setCheckout,
  scope,
  options,
  disabled,
  submission,
  onSubmittingChange,
}: {
  productId: string;
  setCheckout?: {
    selection: SaleJewelrySetSelection;
    products: JewelrySetProduct[];
  };
  scope: SaleScope;
  options: SaleOptions;
  disabled: boolean;
  submission: Submission;
  onSubmittingChange: (submitting: boolean) => void;
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
      items:
        setCheckout?.products.slice(1).map(({ id, code, name }) => ({
          productId: id,
          label: `${code} · ${name}`,
          saleAmount: "",
        })) ?? [],
      tradeIns: [],
      payments: [],
    },
    mode: "onSubmit",
    // Keep inline errors in place while a submit click moves focus off an input.
    reValidateMode: "onSubmit",
    resolver: saleResolver(productId, options, setCheckout?.selection),
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
    setCheckout && { productId, jewelrySet: setCheckout.selection },
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
  const setPreviewError =
    previewQuery.error?.code === "JEWELRY_SET_CHANGED"
      ? "setChanged"
      : previewQuery.error?.code === "JEWELRY_SET_PRODUCT_UNAVAILABLE"
        ? "setUnavailable"
        : previewQuery.error?.code === "JEWELRY_SET_NOT_FOUND"
          ? "setMissing"
          : undefined;
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
      else if (error.message === "generic") toast.error(t("errors.generic"));
      else setMessage(error.message);
    }
  }
  const submitting = useRef(false);
  const submitSale = form.handleSubmit((payload) =>
    submitAction(() => submission.submit(payload)),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || disabled || setPreviewError) return;
    submitting.current = true;
    onSubmittingChange(true);
    try {
      await submitSale(event);
    } finally {
      submitting.current = false;
      onSubmittingChange(false);
    }
  }
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
        <PendingButton
          pending={submission.busy}
          type="button"
          disabled={submission.busy}
          className="min-h-11 lg:min-h-9"
          onClick={() => void submitAction(submission.confirm)}
        >
          {t(submission.busy ? "saving" : "confirmSale")}
        </PendingButton>
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
          component={setCheckout?.products[0]}
          currency={currency}
          retailRates={options.retailRates}
          disabled={disabled}
          id="sale-amount"
          error={errors.saleAmount}
        />
        {items.fields.map((item, index) => (
          <div
            className="grid gap-3 rounded-lg border border-border bg-card p-3"
            key={item.id}
          >
            <SalePriceField
              form={form}
              name={`items.${index}.saleAmount`}
              scope={scope}
              productId={item.productId}
              component={setCheckout?.products[index + 1]}
              currency={currency}
              retailRates={options.retailRates}
              disabled={disabled}
              id={`sale-item-amount-${item.id}`}
              error={errors.items?.[index]?.saleAmount}
            />
            {!setCheckout && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 justify-self-start lg:min-h-9"
                onClick={() => items.remove(index)}
              >
                <Trash2 aria-hidden="true" />
                {t("removeProduct")}
              </Button>
            )}
          </div>
        ))}
        {!setCheckout &&
          (picking ? (
            <ProductPicker
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
          ))}
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
                      <OptionSelect
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
          {activePreview && previewQuery.isError && !setPreviewError && (
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
              <Checkbox
                id="sale-no-payment"
                disabled={disabled}
                checked={noPayment}
                onCheckedChange={(checked) => {
                  form.setValue("noPayment", checked === true, {
                    shouldDirty: true,
                  });
                  form.clearErrors("customerId");
                }}
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
                selectCurrency={(value) =>
                  form.setValue(`payments.${index}.currency`, value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: form.formState.isSubmitted,
                  })
                }
                selectMethod={(method) => {
                  const value = salePaymentMethods.find(
                    (option) => option === method,
                  );
                  if (value) form.setValue(`payments.${index}.method`, value);
                }}
                errors={errors.payments?.[index]}
                disabled={disabled}
                fields={{
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
        {setPreviewError && (
          <p role="alert" className="text-destructive">
            {t(`errors.${setPreviewError}`)}
          </p>
        )}
        {message &&
          message !== setPreviewError &&
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
        <PendingButton
          pending={form.formState.isSubmitting || submission.busy}
          ref={saveButton}
          type="submit"
          className="min-h-11 justify-self-start lg:min-h-9"
          disabled={
            form.formState.isSubmitting || disabled || !!setPreviewError
          }
        >
          {t(submission.busy ? "saving" : "save")}
        </PendingButton>
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
            onSubmittingChange={onSubmittingChange}
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
