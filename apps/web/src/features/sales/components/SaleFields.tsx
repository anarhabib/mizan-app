import {
  Field,
  FieldDescription,
  FieldError as FieldFeedback,
} from "@/components/ui/field";
import type { ReactNode } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormField({
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
    <Field data-invalid={Boolean(error)} className="grid min-w-0 gap-2">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      {children}
      {hint && (
        <FieldDescription id={`${id}-hint`} className="text-xs">
          {hint}
        </FieldDescription>
      )}
      {error && (
        <FieldFeedback id={`${id}-error`} className="text-xs">
          {error.type === "paymentTooSmall"
            ? t("errors.paymentTooSmall")
            : t("invalidField")}
        </FieldFeedback>
      )}
    </Field>
  );
}

export function DecimalInput({
  name,
  label,
  id,
  error,
  hint,
  required,
}: {
  name: UseFormRegisterReturn;
  label: string;
  id: string;
  error?: FieldError;
  hint?: string;
  required?: boolean;
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
        aria-required={required}
        aria-describedby={describedBy}
        className="min-h-11 tabular-nums lg:min-h-9"
        {...name}
      />
    </FormField>
  );
}
