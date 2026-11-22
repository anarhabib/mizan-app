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
    <div className="grid min-w-0 gap-2">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error.type === "paymentTooSmall"
            ? t("errors.paymentTooSmall")
            : t("invalidField")}
        </p>
      )}
    </div>
  );
}

export function DecimalInput({
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
