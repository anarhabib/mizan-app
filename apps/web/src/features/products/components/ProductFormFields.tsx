import { useEffect, useRef, type ReactNode } from "react";
import {
  Controller,
  get,
  useFieldArray,
  type FieldPath,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  gemstoneOrigins,
  maxGemstoneGroups,
  type ProductCreateInput,
} from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import type { ProductFormValues } from "../lib/form";

type ProductFormState = UseFormReturn<
  ProductFormValues,
  unknown,
  ProductCreateInput
>;

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

export function ProductTextField({
  form,
  name,
  label,
  error,
  busy,
  decimal,
  numeric,
  currency,
  multiline,
}: {
  form: ProductFormState;
  name: FieldPath<ProductFormValues>;
  label: string;
  error?: string;
  busy: boolean;
  decimal?: boolean;
  numeric?: boolean;
  currency?: boolean;
  multiline?: boolean;
}) {
  const id = `create-product-${name}`;
  const registration = form.register(name, {
    onChange: () => {
      if (form.getFieldState(name).invalid) form.clearErrors(name);
      if (currency) {
        const amount = name.replace(
          /\.currency$/,
          ".amount",
        ) as FieldPath<ProductFormValues>;
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
          readOnly={busy}
          className="min-h-20"
        />
      ) : (
        <Input
          {...registration}
          {...accessibility}
          readOnly={busy}
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

export function GemstoneFields({
  form,
  busy,
}: {
  form: ProductFormState;
  busy: boolean;
}) {
  const { t } = useTranslation("products");
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "gemstones",
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
          const name = `gemstones.${index}.${field}` as const;
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
              name={`gemstones.${index}.origin`}
              render={({ field }) => (
                <div className="grid gap-2">
                  <Label htmlFor={`product-gemstone-origin-${index}`}>
                    {t("jewelry.stoneFields.origin")}
                  </Label>
                  <OptionSelect
                    id={`product-gemstone-origin-${index}`}
                    ref={field.ref}
                    value={field.value ?? "UNKNOWN"}
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
          append(
            { gemstoneType: "", stoneCount: "", origin: "UNKNOWN" },
            { focusName: `gemstones.${fields.length}.gemstoneType` },
          )
        }
      >
        {t("jewelry.addGroup")}
      </Button>
    </section>
  );
}
