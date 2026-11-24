import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  Controller,
  get,
  useFieldArray,
  type FieldArray,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { gemstoneOrigins, maxGemstoneGroups } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { gemstoneFormDefaults, type ProductFormValues } from "../lib/form";

export function ProductDisclosure({
  label,
  reveal,
  submitCount,
  className,
  children,
}: {
  label: string;
  reveal: boolean;
  submitCount: number;
  className?: string;
  children: ReactNode;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (reveal && disclosure.current) disclosure.current.open = true;
  }, [reveal, submitCount]);
  return (
    <details ref={disclosure} className={className}>
      <summary className="min-h-11 cursor-pointer content-center font-medium lg:min-h-9">
        {label}
      </summary>
      {children}
    </details>
  );
}

export function ProductTextField<T extends FieldValues>({
  form,
  name,
  label,
  error,
  busy,
  decimal,
  numeric,
  currency,
  multiline,
  readOnly,
  onValueChange,
}: {
  form: Pick<UseFormReturn<T>, "register" | "getFieldState" | "clearErrors">;
  name: FieldPath<T>;
  label: string;
  error?: string;
  busy: boolean;
  decimal?: boolean;
  numeric?: boolean;
  currency?: boolean;
  multiline?: boolean;
  readOnly?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const id = useId();
  const registration = form.register(name, {
    onChange: (event) => {
      if (form.getFieldState(name).invalid) form.clearErrors(name);
      onValueChange?.(event.target.value);
      if (currency) {
        const amount = name.replace(/\.currency$/, ".amount") as FieldPath<T>;
        if (form.getFieldState(amount).invalid) form.clearErrors(amount);
      }
    },
  });
  const accessibility = {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : undefined,
  };
  return (
    <div data-form-field className="grid min-w-0 content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          {...registration}
          {...accessibility}
          rows={3}
          readOnly={busy || readOnly}
          className="min-h-20"
        />
      ) : (
        <Input
          {...registration}
          {...accessibility}
          readOnly={busy || readOnly}
          inputMode={decimal ? "decimal" : numeric ? "numeric" : "text"}
          enterKeyHint="next"
          autoComplete="off"
          maxLength={currency ? 3 : undefined}
          autoCapitalize={currency ? "characters" : undefined}
          className="min-h-11 lg:min-h-9"
        />
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const basicGemstoneFields = [
  "gemstoneType",
  "stoneCount",
  "totalCarats",
] as const;
const advancedGemstoneFields = [
  "individualCarats",
  "shape",
  "color",
  "clarity",
  "cutGrade",
  "treatment",
  "laboratory",
  "reportNumber",
  "note",
] as const;

type GemstoneFormValues = Pick<ProductFormValues, "gemstones">;

export function GemstoneFields<
  T extends FieldValues & GemstoneFormValues,
  Output extends FieldValues,
>({ form, busy }: { form: UseFormReturn<T, unknown, Output>; busy: boolean }) {
  const id = useId();
  const { t } = useTranslation("products");
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "gemstones" as FieldArrayPath<T>,
  });
  const {
    errors: { gemstones: errors },
    submitCount,
  } = form.formState;

  return (
    <section aria-label={t("jewelry.gemstones")} className="grid gap-3">
      {fields.map((group, index) => {
        function renderGemstoneText(
          field: (
            typeof basicGemstoneFields | typeof advancedGemstoneFields
          )[number],
        ) {
          const name = `gemstones.${index}.${field}` as FieldPath<T>;
          const validation = field.endsWith("Carats")
            ? "carats"
            : field === "stoneCount"
              ? "count"
              : "text";
          return (
            <ProductTextField
              key={field}
              form={form}
              name={name}
              label={t(`jewelry.stoneFields.${field}`)}
              error={
                get(errors, `${index}.${field}`)
                  ? t(`jewelry.validation.${validation}`)
                  : undefined
              }
              busy={busy}
              decimal={field.endsWith("Carats")}
              numeric={field === "stoneCount"}
              multiline={field === "note"}
            />
          );
        }
        return (
          <fieldset
            key={group.id}
            className="grid min-w-0 gap-3 rounded-md border p-3"
          >
            <legend className="px-2 font-medium">
              {t("jewelry.group", { index: index + 1 })}
            </legend>
            {basicGemstoneFields.map(renderGemstoneText)}
            <Controller
              control={form.control}
              name={`gemstones.${index}.origin` as FieldPath<T>}
              render={({ field }) => (
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-gemstone-origin-${index}`}>
                    {t("jewelry.stoneFields.origin")}
                  </Label>
                  <OptionSelect
                    id={`${id}-gemstone-origin-${index}`}
                    ref={field.ref}
                    value={
                      typeof field.value === "string" ? field.value : "UNKNOWN"
                    }
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    disabled={busy}
                    options={gemstoneOrigins.map((value) => ({
                      value,
                      label: t(`jewelry.origins.${value}`),
                    }))}
                  />
                </div>
              )}
            />
            <ProductDisclosure
              label={t("jewelry.moreStoneDetails")}
              submitCount={submitCount}
              reveal={advancedGemstoneFields.some((field) =>
                get(errors, `${index}.${field}`),
              )}
            >
              <div className="align-form-fields mt-2 grid grid-cols-2 gap-2">
                {advancedGemstoneFields.map(renderGemstoneText)}
              </div>
            </ProductDisclosure>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 justify-self-start lg:min-h-9"
              disabled={busy}
              onClick={() => remove(index)}
              aria-label={t("jewelry.removeGroup", { index: index + 1 })}
            >
              {t("jewelry.remove")}
            </Button>
          </fieldset>
        );
      })}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 justify-self-start lg:min-h-9"
        disabled={busy || fields.length >= maxGemstoneGroups}
        onClick={() =>
          append(gemstoneFormDefaults() as FieldArray<T, FieldArrayPath<T>>, {
            focusName: `gemstones.${fields.length}.gemstoneType`,
          })
        }
      >
        {t("jewelry.addGroup")}
      </Button>
    </section>
  );
}
