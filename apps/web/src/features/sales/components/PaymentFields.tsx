import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FieldErrors, UseFormRegisterReturn } from "react-hook-form";
import { checkoutCurrencies, salePaymentMethods } from "@mizan/contracts";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exchangeRatesQuery,
  suggestedExchangeRate,
} from "@/features/exchange-rates";
import { MoneyText } from "@/shared/ui/MoneyText";
import { useWorkspace } from "@/features/workspace";
import { paymentPreviewQuery, type SaleScope } from "../api/queries";
import { buildPayment, type PaymentValues } from "../lib/form";
import { DecimalInput, FormField } from "./SaleFields";

export function PaymentFields({
  scope,
  values,
  setExchangeRate,
  selectMethod,
  fields,
  errors,
  disabled,
}: {
  scope: SaleScope;
  values: PaymentValues;
  setExchangeRate: (rate: string) => void;
  selectMethod: (method: string) => void;
  fields: Record<Exclude<keyof PaymentValues, "method">, UseFormRegisterReturn>;
  errors?: FieldErrors<PaymentValues>;
  disabled: boolean;
}) {
  const { t } = useTranslation("sales");
  const currencies = checkoutCurrencies(useWorkspace().settings);
  const id = useId();
  const { currency, method, exchangeRate } = values;
  const normalizedCurrency = currency.trim().toUpperCase();
  const rates = useQuery(exchangeRatesQuery(scope));
  const suggestion = suggestedExchangeRate(rates.data, normalizedCurrency);
  const manuallyEdited = useRef(false);
  useEffect(() => {
    if (!disabled && suggestion && !exchangeRate && !manuallyEdited.current) {
      setExchangeRate(suggestion);
    }
  }, [disabled, exchangeRate, setExchangeRate, suggestion]);

  const payment = buildPayment(values);
  const serialized =
    normalizedCurrency !== "AZN" && "input" in payment
      ? JSON.stringify(payment.input)
      : undefined;
  const [debounced, setDebounced] = useState<string>();
  useEffect(() => {
    if (!serialized || disabled) return;
    const timeout = setTimeout(() => setDebounced(serialized), 300);
    return () => clearTimeout(timeout);
  }, [disabled, serialized]);
  const active = serialized !== undefined && debounced === serialized;
  const preview = useQuery(
    paymentPreviewQuery(scope, active ? serialized : undefined),
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField
        id={`${id}-method`}
        label={t("fields.paymentMethod")}
        error={errors?.method}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              id={`${id}-method`}
              type="button"
              variant="outline"
              disabled={disabled}
              className="min-h-11 justify-between lg:min-h-9"
              aria-labelledby={`${id}-method-label ${id}-method-value`}
            >
              <span id={`${id}-method-value`}>{t(`methods.${method}`)}</span>
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup value={method} onValueChange={selectMethod}>
              {salePaymentMethods.map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  {t(`methods.${option}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </FormField>
      <FormField
        id={`${id}-currency`}
        label={t("fields.paymentCurrency")}
        error={errors?.currency}
      >
        <select
          id={`${id}-currency`}
          disabled={disabled}
          className="h-11 rounded-md border border-control-border bg-control px-2 focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
          aria-invalid={Boolean(errors?.currency)}
          aria-describedby={
            errors?.currency ? `${id}-currency-error` : undefined
          }
          {...fields.currency}
          value={
            currencies.includes(normalizedCurrency) ? normalizedCurrency : ""
          }
          onChange={(event) => {
            const next = event.target.value.trim().toUpperCase();
            void fields.currency.onChange(event);
            if (next !== normalizedCurrency) {
              manuallyEdited.current = false;
              setExchangeRate(suggestedExchangeRate(rates.data, next) ?? "");
            }
          }}
        >
          {!currencies.includes(normalizedCurrency) && (
            <option value="" disabled>
              —
            </option>
          )}
          {currencies.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FormField>
      <DecimalInput
        name={fields.amount}
        label={t("amountCurrency", {
          label: t("fields.paymentAmount"),
          currency: normalizedCurrency,
        })}
        id={`${id}-amount`}
        error={errors?.amount}
      />
      {normalizedCurrency !== "AZN" && (
        <DecimalInput
          name={{
            ...fields.exchangeRate,
            onChange: (event) => {
              manuallyEdited.current = true;
              return fields.exchangeRate.onChange(event);
            },
          }}
          label={t("fields.exchangeRate")}
          id={`${id}-rate`}
          error={errors?.exchangeRate}
          hint={t("exchangeRateHint", {
            paymentCurrency: normalizedCurrency,
            currency: "AZN",
          })}
        />
      )}
      {suggestion &&
        exchangeRate === suggestion &&
        (rates.data?.stale || rates.isError) && (
          <p className="text-xs text-warning-foreground sm:col-span-2">
            {t("cachedExchangeRate")}
          </p>
        )}
      {active && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:col-span-2"
        >
          {preview.data ? (
            <>
              {t("aznEquivalent")} <MoneyText value={preview.data} />
            </>
          ) : preview.isError ? (
            <>
              {t("conversionUnavailable")}
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 lg:min-h-9"
                disabled={disabled || preview.isFetching}
                onClick={() => void preview.refetch()}
              >
                {t("retryPreview")}
              </Button>
            </>
          ) : (
            t("conversionLoading")
          )}
        </div>
      )}
    </div>
  );
}
