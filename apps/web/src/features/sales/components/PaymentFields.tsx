import { useId } from "react";
import type { FieldErrors, UseFormRegisterReturn } from "react-hook-form";
import { salePaymentMethods } from "@mizan/contracts";
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
import { Input } from "@/components/ui/input";
import type { PaymentValues } from "../lib/form";
import { DecimalInput, FormField } from "./SaleFields";

const currencies = Intl.supportedValuesOf("currency");

export function PaymentFields({
  currency,
  method,
  selectMethod,
  fields,
  errors,
  disabled,
}: {
  currency: string;
  method: PaymentValues["method"];
  selectMethod: (method: string) => void;
  fields: Record<Exclude<keyof PaymentValues, "method">, UseFormRegisterReturn>;
  errors?: FieldErrors<PaymentValues>;
  disabled: boolean;
}) {
  const { t } = useTranslation("sales");
  const id = useId();
  const normalizedCurrency = currency.trim().toUpperCase();
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
        <Input
          id={`${id}-currency`}
          list={`${id}-currencies`}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={3}
          className="min-h-11 uppercase lg:min-h-9"
          aria-invalid={Boolean(errors?.currency)}
          aria-describedby={
            errors?.currency ? `${id}-currency-error` : undefined
          }
          {...fields.currency}
        />
        <datalist id={`${id}-currencies`}>
          {currencies.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
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
          name={fields.exchangeRate}
          label={t("fields.exchangeRate")}
          id={`${id}-rate`}
          error={errors?.exchangeRate}
          hint={t("exchangeRateHint", {
            paymentCurrency: normalizedCurrency,
            currency: "AZN",
          })}
        />
      )}
    </div>
  );
}
