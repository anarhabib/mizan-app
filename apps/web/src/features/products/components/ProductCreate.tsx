import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldError,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  parseProductAcquisition,
  acquisitionComponents,
  type ProductCreateInput,
  type ProductDetail,
} from "@mizan/contracts";
import { MoneyText } from "@/shared/ui/MoneyText";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/shared/lib/api";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { useCreateProduct } from "../api/mutations";
import { productOptionsQuery, type ProductScope } from "../api/queries";
import {
  productErrorField,
  productAcquisitionValues,
  resolveProductForm,
  usesTotalAcquisition,
  type ProductFormValues,
} from "../lib/form";
import { ProductPanel } from "./ProductPanel";
import {
  GemstoneFields,
  ProductDisclosure,
  ProductTextField,
} from "./ProductFormFields";

type TextField =
  | "code"
  | "name"
  | "category"
  | "weight"
  | "netGoldWeight"
  | "acquisitionCostPerGram.amount"
  | "acquisitionCostPerGram.currency"
  | "acquisitionCost.amount"
  | "acquisitionCost.currency"
  | "fixedSellingPrice.amount"
  | "fixedSellingPrice.currency"
  | "note";

export function ProductCreate({
  scope,
  currency,
  opener,
  close,
  created,
}: {
  scope: ProductScope;
  currency: string;
  opener: HTMLElement;
  close: () => void;
  created: (product: ProductDetail) => void;
}) {
  const { t } = useTranslation("products");
  const options = useQuery(productOptionsQuery(scope));
  const create = useCreateProduct(scope);
  const [submitting, setSubmitting] = useState(false);

  return (
    <ProductPanel
      title={t("create")}
      opener={opener}
      close={close}
      busy={submitting || create.isPending}
    >
      {options.isPending ? (
        <ListSkeleton rows={3} />
      ) : options.isError ? (
        <ErrorState
          error={options.error}
          retry={() => void options.refetch()}
          pending={options.isFetching}
        />
      ) : options.data.purities.length === 0 ? (
        <EmptyState title={t("noPurities")} description={t("noPuritiesHint")} />
      ) : (
        <ProductForm
          currency={currency}
          purities={options.data.purities}
          pending={create.isPending}
          onSubmittingChange={setSubmitting}
          save={async (input) => {
            const product = await create.mutateAsync(input);
            toast.success(t("created"));
            created(product);
          }}
        />
      )}
    </ProductPanel>
  );
}

export function ProductForm({
  currency,
  purities = [],
  product,
  pending,
  onSubmittingChange,
  save,
}: {
  currency: string;
  purities?: number[];
  product?: ProductDetail;
  pending: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  save: (input: ProductCreateInput) => Promise<void>;
}) {
  const { t } = useTranslation(["products", "errors"]);
  const form = useForm<ProductFormValues, unknown, ProductCreateInput>({
    resolver: (values) => resolveProductForm(values, Boolean(product)),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      code: product?.code ?? "",
      name: product?.name ?? "",
      category: product?.category ?? "",
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
    },
  });
  const { errors, isSubmitting, submitCount } = form.formState;
  const busy = isSubmitting || pending;
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
        multiline={field === "note"}
      />
    );
  }

  const rootError = errors.root?.type;
  return (
    <form
      onSubmit={submitForm}
      noValidate
      aria-busy={busy}
      className="grid gap-4"
    >
      {!product && (
        <>
          {renderText("code", errors.code)}
          {renderText("name", errors.name)}
          {renderText("category", errors.category)}
          <p className="text-sm text-muted-foreground">
            {t("fields.metalType")} · {t("jewelry.gold")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="purity"
              render={({ field, fieldState }) => (
                <div className="grid content-start gap-2">
                  <Label htmlFor="create-product-purity">
                    {t("fields.purity")}
                  </Label>
                  <OptionSelect
                    id="create-product-purity"
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    disabled={busy}
                    placeholder={t("choosePurity")}
                    invalid={fieldState.invalid}
                    describedBy={
                      fieldState.error
                        ? "create-product-purity-error"
                        : undefined
                    }
                    options={purities.map((purity) => ({
                      value: String(purity),
                      label: String(purity),
                    }))}
                  />
                  {fieldState.error && (
                    <p
                      id="create-product-purity-error"
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
                <Label htmlFor="product-acquisition-mode">
                  {t("jewelry.acquisition")}
                </Label>
                <OptionSelect
                  id="product-acquisition-mode"
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
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          {totalAcquisition
            ? renderText(
                "acquisitionCost.amount",
                errors.acquisitionCost?.amount,
              )
            : renderText(
                "acquisitionCostPerGram.amount",
                errors.acquisitionCostPerGram?.amount,
              )}
          {totalAcquisition
            ? renderText(
                "acquisitionCost.currency",
                errors.acquisitionCost?.currency,
              )
            : renderText(
                "acquisitionCostPerGram.currency",
                errors.acquisitionCostPerGram?.currency,
              )}
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
            <div className="grid grid-cols-2 gap-3">
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
          <AcquisitionPreview control={form.control} />
        )}
      </section>
      <ProductDisclosure
        className="rounded-md border p-3"
        label={t("jewelry.fixedOptional")}
        reveal={Boolean(product?.fixedSellingPrice || errors.fixedSellingPrice)}
        submitCount={submitCount}
      >
        <div className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
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
      {rootError && (
        <p role="alert" className="text-destructive">
          {t(product ? "editUncertain" : "createUncertain")}
        </p>
      )}
      <PendingButton
        pending={busy}
        type="submit"
        className="min-h-11 lg:min-h-9"
      >
        {t(busy ? "saving" : "save")}
      </PendingButton>
    </form>
  );
}

function AcquisitionPreview({
  control,
}: {
  control: Control<ProductFormValues, unknown, ProductCreateInput>;
}) {
  const { t } = useTranslation("products");
  const [weight, acquisitionCostPerGram] = useWatch({
    control,
    name: ["weight", "acquisitionCostPerGram"],
  });
  const preview = parseProductAcquisition(
    productAcquisitionValues({ weight, acquisitionCostPerGram }),
  );

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted p-3">
      <span id="acquisition-total-label" className="text-muted-foreground">
        {t("fields.acquisitionCost")}
      </span>
      <output
        aria-labelledby="acquisition-total-label"
        className="wrap-anywhere font-medium"
      >
        {"total" in preview ? <MoneyText value={preview.total} /> : "—"}
      </output>
    </div>
  );
}
