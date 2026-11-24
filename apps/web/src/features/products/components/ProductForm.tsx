import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { useQuery } from "@tanstack/react-query";
import { useId, useRef, type FormEvent } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldError,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  parseProductAcquisition,
  categoryLabel,
  acquisitionComponents,
  type ProductCreateInput,
  type ProductDetail,
} from "@mizan/contracts";
import { MoneyText } from "@/shared/ui/MoneyText";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/shared/lib/api";
import { categoryQuery } from "@/features/product-categories";
import { useWorkspace } from "@/features/workspace";
import { Button } from "@/components/ui/button";
import type { ProductScope } from "../api/queries";
import {
  productErrorField,
  productAcquisitionValues,
  resolveProductForm,
  usesTotalAcquisition,
  type ProductFormValues,
} from "../lib/form";
import {
  GemstoneFields,
  ProductDisclosure,
  ProductTextField,
} from "./ProductFormFields";

type TextField =
  | "code"
  | "name"
  | "weight"
  | "netGoldWeight"
  | "acquisitionCostPerGram.amount"
  | "acquisitionCostPerGram.currency"
  | "acquisitionCost.amount"
  | "acquisitionCost.currency"
  | "fixedSellingPrice.amount"
  | "fixedSellingPrice.currency"
  | "note";

export type ProductFormState = UseFormReturn<
  ProductFormValues,
  unknown,
  ProductCreateInput
>;
export function useProductCategories(scope: ProductScope) {
  const { canManageAsOwner } = useWorkspace();
  const categories = useQuery(
    categoryQuery(scope.organizationId, canManageAsOwner),
  );
  return categories;
}

export function productDefaults(
  currency: string,
  product?: ProductDetail,
): ProductFormValues {
  const currentCategory = product?.productCategory;
  return {
    code: product?.code ?? "",
    name: product?.name ?? "",
    categoryId: currentCategory?.id ?? "",
    purity: product ? String(product.purity) : "",
    weight: product?.weight ?? "",
    netGoldWeight: product?.netGoldWeight ?? "",
    acquisitionCostPerGram: product?.acquisitionCostPerGram ?? {
      amount: "",
      currency: product?.acquisitionCost?.currency ?? currency,
    },
    acquisitionMode:
      product && !product.acquisitionCostPerGram ? "TOTAL" : "PER_GRAM",
    acquisitionCost: product?.acquisitionCost ?? { amount: "", currency },
    acquisitionBreakdown: product?.acquisitionBreakdown ?? {},
    fixedSellingPrice: product?.fixedSellingPrice ?? { amount: "", currency },
    gemstones:
      product?.gemstones?.map((group) => ({
        ...group,
        stoneCount: String(group.stoneCount),
      })) ?? [],
    note: product?.note ?? "",
  };
}

export function ProductForm({
  scope,
  currency,
  purities = [],
  product,
  pending,
  onSubmittingChange,
  save,
  acquisitionCurrencyLocked = false,
  submitLabel,
}: {
  scope: ProductScope;
  currency: string;
  purities?: number[];
  product?: ProductDetail;
  pending: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  save: (input: ProductCreateInput) => Promise<void>;
  acquisitionCurrencyLocked?: boolean;
  submitLabel?: string;
}) {
  const { t } = useTranslation(["products", "errors", "shell"]);
  const categories = useProductCategories(scope);
  const form = useForm<ProductFormValues, unknown, ProductCreateInput>({
    resolver: (values) => resolveProductForm(values, Boolean(product)),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: productDefaults(currency, product),
  });
  const { errors, isSubmitting } = form.formState;
  const busy = isSubmitting || pending;
  const submitting = useRef(false);
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    try {
      await save(values);
    } catch (error) {
      if (error instanceof ApiError) {
        const field = productErrorField(error);
        if (field) {
          form.setError(field, { type: error.code }, { shouldFocus: true });
          return;
        }
      }
      if (error instanceof ApiError && error.isNetwork) {
        form.setError("root", { type: "uncertain" });
      } else {
        const code = error instanceof ApiError ? error.code : "";
        toast.error(
          t(
            code === "PRODUCT_EDIT_CONFLICT" ||
              code === "PRODUCT_NOT_FOUND" ||
              code === "INVALID_PRODUCT" ||
              code === "ACCESS_DENIED" ||
              code === "AUTH_UNAVAILABLE"
              ? code
              : "generic",
            { ns: "errors" },
          ),
        );
      }
    }
  });

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || pending) return;
    submitting.current = true;
    onSubmittingChange(true);
    try {
      await submit(event);
    } finally {
      submitting.current = false;
      onSubmittingChange(false);
    }
  }

  return (
    <form
      onSubmit={submitForm}
      noValidate
      aria-busy={busy}
      className="grid gap-4"
    >
      <ProductFields
        {...{
          form,
          product,
          purities,
          busy,
          categories,
          acquisitionCurrencyLocked,
        }}
      />
      {errors.root?.type && (
        <p role="alert" className="text-destructive">
          {t(product ? "editUncertain" : "createUncertain")}
        </p>
      )}
      <PendingButton
        pending={busy}
        disabled={
          !product && !categories.data?.some(({ isActive }) => isActive)
        }
        type="submit"
        className="min-h-11 lg:min-h-9"
      >
        {busy ? t("saving") : (submitLabel ?? t("save"))}
      </PendingButton>
    </form>
  );
}

export function ProductFields({
  form,
  product,
  purities,
  busy,
  categories,
  acquisitionCurrencyLocked,
  sharedCurrency,
}: {
  form: ProductFormState;
  product?: ProductDetail;
  purities: number[];
  busy: boolean;
  categories: ReturnType<typeof useProductCategories>;
  acquisitionCurrencyLocked?: boolean;
  sharedCurrency?: string;
}) {
  const { t, i18n } = useTranslation(["products", "errors", "shell"]);
  const id = useId();
  const { errors, submitCount } = form.formState;
  const activeCategories =
    categories.data?.filter((category) => category.isActive) ?? [];
  const currentCategory = product?.productCategory;
  const categoryOptions =
    currentCategory &&
    !activeCategories.some(({ id }) => id === currentCategory.id)
      ? [currentCategory, ...activeCategories]
      : activeCategories;
  const acquisitionMode = useWatch({
    control: form.control,
    name: "acquisitionMode",
  });
  const hasGemstones = useWatch({
    control: form.control,
    name: "gemstones",
    compute: (groups) => Boolean(groups?.length),
  });
  const totalAcquisition = usesTotalAcquisition(acquisitionMode, hasGemstones);
  function fieldMessage(error: FieldError, field: TextField | "purity") {
    if (error.type === "PRODUCT_CODE_CONFLICT")
      return t("PRODUCT_CODE_CONFLICT", { ns: "errors" });
    if (field === "weight") return t("validation.weight");
    if (
      field === "acquisitionCostPerGram.amount" ||
      field === "acquisitionCostPerGram.currency"
    )
      return t("validation.cost");
    if (
      field === "acquisitionCost.amount" ||
      field === "acquisitionCost.currency"
    )
      return t("jewelry.validation.total");
    if (
      field === "fixedSellingPrice.amount" ||
      field === "fixedSellingPrice.currency"
    )
      return t("jewelry.validation.fixed");
    return t(`validation.${field}`);
  }

  function renderText(field: TextField, error?: FieldError) {
    return (
      <ProductTextField
        key={field}
        form={form}
        name={field}
        label={t(`formFields.${field}`)}
        error={error && fieldMessage(error, field)}
        busy={busy}
        decimal={
          field === "weight" ||
          field === "netGoldWeight" ||
          field.endsWith(".amount")
        }
        currency={field.endsWith(".currency")}
        readOnly={
          acquisitionCurrencyLocked &&
          field.startsWith("acquisition") &&
          field.endsWith(".currency")
        }
        multiline={field === "note"}
      />
    );
  }

  return (
    <div className="grid gap-4">
      {!product && (
        <div className="grid gap-3 lg:grid-cols-2">
          {renderText("code", errors.code)}
          {renderText("name", errors.name)}
        </div>
      )}
      <Controller
        control={form.control}
        name="categoryId"
        render={({ field, fieldState }) => {
          const invalid =
            fieldState.error?.type === "CATEGORY_UNAVAILABLE"
              ? t("CATEGORY_UNAVAILABLE", { ns: "errors" })
              : t("validation.category");
          return (
            <div className="grid min-w-0 gap-2">
              <Label htmlFor={`${id}-product-category`}>
                {t("fields.category")}
              </Label>
              <OptionSelect
                id={`${id}-product-category`}
                ref={field.ref}
                value={field.value ?? ""}
                onBlur={field.onBlur}
                onChange={field.onChange}
                disabled={busy || !categoryOptions.length || !categories.data}
                placeholder={t(
                  categories.isPending ? "loadingCategories" : "chooseCategory",
                )}
                invalid={fieldState.invalid}
                describedBy={
                  fieldState.invalid
                    ? `${id}-product-category-error`
                    : undefined
                }
                options={categoryOptions.map((category) => ({
                  value: category.id,
                  label: categoryLabel(category, i18n.resolvedLanguage),
                }))}
              />
              {fieldState.invalid && (
                <p
                  id={`${id}-product-category-error`}
                  className="text-destructive"
                >
                  {invalid}
                </p>
              )}
              {categories.isError && !categories.data && (
                <div className="flex flex-wrap items-center gap-2">
                  <p role="alert" className="text-destructive">
                    {t("categoryLoadError")}
                  </p>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => void categories.refetch()}
                  >
                    {t("retry", { ns: "shell" })}
                  </Button>
                </div>
              )}
              {categories.isSuccess && !categoryOptions.length && (
                <p role="status" className="text-muted-foreground">
                  {t("noCategories")}
                </p>
              )}
            </div>
          );
        }}
      />
      {!product && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("fields.metalType")} Â· {t("jewelry.gold")}
          </p>
          <div className="align-form-fields grid grid-cols-2 gap-2">
            <Controller
              control={form.control}
              name="purity"
              render={({ field, fieldState }) => (
                <div
                  data-form-field
                  className="grid min-w-0 content-start gap-2"
                >
                  <Label htmlFor={`${id}-create-product-purity`}>
                    {t("fields.purity")}
                  </Label>
                  <OptionSelect
                    id={`${id}-create-product-purity`}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    disabled={busy}
                    placeholder={t("choosePurity")}
                    invalid={fieldState.invalid}
                    describedBy={
                      fieldState.error
                        ? `${id}-create-product-purity-error`
                        : undefined
                    }
                    options={purities.map((purity) => ({
                      value: String(purity),
                      label: String(purity),
                    }))}
                  />
                  {fieldState.error && (
                    <p
                      id={`${id}-create-product-purity-error`}
                      className="text-xs text-destructive"
                    >
                      {fieldMessage(fieldState.error, "purity")}
                    </p>
                  )}
                </div>
              )}
            />
            {renderText("weight", errors.weight)}
          </div>
        </>
      )}
      {product && renderText("weight", errors.weight)}
      {renderText("netGoldWeight", errors.netGoldWeight)}
      {!product && <GemstoneFields form={form} busy={busy} />}
      <section className="grid gap-3" aria-label={t("jewelry.acquisition")}>
        {hasGemstones ? (
          <p className="text-sm text-muted-foreground">
            {t("jewelry.stoneAcquisition")}
          </p>
        ) : (
          <Controller
            control={form.control}
            name="acquisitionMode"
            render={({ field }) => (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-product-acquisition-mode`}>
                  {t("jewelry.acquisition")}
                </Label>
                <OptionSelect
                  id={`${id}-product-acquisition-mode`}
                  ref={field.ref}
                  value={field.value ?? "PER_GRAM"}
                  onBlur={field.onBlur}
                  onChange={(value) => {
                    field.onChange(value);
                    form.clearErrors([
                      "acquisitionCost",
                      "acquisitionCostPerGram",
                      "acquisitionBreakdown",
                    ]);
                  }}
                  disabled={busy}
                  options={[
                    { value: "PER_GRAM", label: t("jewelry.perGram") },
                    { value: "TOTAL", label: t("jewelry.supplierTotal") },
                  ]}
                />
              </div>
            )}
          />
        )}
        <div
          className={
            sharedCurrency === undefined
              ? "align-form-fields grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-x-3 gap-y-2"
              : "grid gap-2"
          }
        >
          {totalAcquisition
            ? renderText(
                "acquisitionCost.amount",
                errors.acquisitionCost?.amount,
              )
            : renderText(
                "acquisitionCostPerGram.amount",
                errors.acquisitionCostPerGram?.amount,
              )}
          {sharedCurrency === undefined &&
            (totalAcquisition
              ? renderText(
                  "acquisitionCost.currency",
                  errors.acquisitionCost?.currency,
                )
              : renderText(
                  "acquisitionCostPerGram.currency",
                  errors.acquisitionCostPerGram?.currency,
                ))}
        </div>
        {totalAcquisition ? (
          <ProductDisclosure
            className="rounded-md border p-3"
            label={t("jewelry.breakdown")}
            reveal={Boolean(errors.acquisitionBreakdown)}
            submitCount={submitCount}
          >
            <p className="my-2 text-sm text-muted-foreground">
              {t("jewelry.breakdownHint")}
            </p>
            {errors.acquisitionBreakdown?.type && (
              <p role="alert" className="my-2 text-xs text-destructive">
                {t("jewelry.validation.breakdownSum")}
              </p>
            )}
            <div className="align-form-fields grid grid-cols-2 gap-2">
              {acquisitionComponents.map((part) => (
                <ProductTextField
                  key={part}
                  form={form}
                  name={`acquisitionBreakdown.${part}`}
                  label={t(`jewelry.components.${part}`)}
                  error={
                    errors.acquisitionBreakdown?.[part] &&
                    t("jewelry.validation.component")
                  }
                  busy={busy}
                  decimal
                />
              ))}
            </div>
          </ProductDisclosure>
        ) : (
          <AcquisitionPreview
            control={form.control}
            sharedCurrency={sharedCurrency}
          />
        )}
      </section>
      <ProductDisclosure
        className="rounded-md border p-3"
        label={t("jewelry.fixedOptional")}
        reveal={Boolean(product?.fixedSellingPrice || errors.fixedSellingPrice)}
        submitCount={submitCount}
      >
        <div className="align-form-fields mt-2 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-x-3 gap-y-2">
          {renderText(
            "fixedSellingPrice.amount",
            errors.fixedSellingPrice?.amount,
          )}
          {renderText(
            "fixedSellingPrice.currency",
            errors.fixedSellingPrice?.currency,
          )}
        </div>
      </ProductDisclosure>
      {!product && renderText("note", errors.note)}
    </div>
  );
}

function AcquisitionPreview({
  control,
  sharedCurrency,
}: {
  control: Control<ProductFormValues, unknown, ProductCreateInput>;
  sharedCurrency?: string;
}) {
  const { t } = useTranslation("products");
  const id = useId();
  const [weight, acquisitionCostPerGram] = useWatch({
    control,
    name: ["weight", "acquisitionCostPerGram"],
  });
  const preview = parseProductAcquisition(
    productAcquisitionValues({
      weight,
      acquisitionCostPerGram: {
        ...acquisitionCostPerGram,
        currency: sharedCurrency ?? acquisitionCostPerGram.currency,
      },
    }),
  );

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted p-3">
      <span id={id} className="text-muted-foreground">
        {t("fields.acquisitionCost")}
      </span>
      <output aria-labelledby={id} className="wrap-anywhere font-medium">
        {"total" in preview ? <MoneyText value={preview.total} /> : "â€”"}
      </output>
    </div>
  );
}
