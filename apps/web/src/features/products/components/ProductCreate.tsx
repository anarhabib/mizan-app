import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
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
  type ProductCreateInput,
  type ProductDetail,
} from "@mizan/contracts";
import { MoneyText } from "@/shared/ui/MoneyText";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/shared/lib/api";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { useCreateProduct } from "../api/mutations";
import { productOptionsQuery, type ProductScope } from "../api/queries";
import {
  productErrorField,
  resolveProductForm,
  type ProductFormValues,
} from "../lib/form";
import { ProductPanel } from "./ProductPanel";

type TextField =
  | "code"
  | "name"
  | "category"
  | "weight"
  | "netGoldWeight"
  | "acquisitionCostPerGram.amount"
  | "acquisitionCostPerGram.currency"
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
      note: product?.note ?? "",
    },
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

  function fieldMessage(error: FieldError, field: TextField | "purity") {
    if (error.type === "PRODUCT_CODE_CONFLICT")
      return t("PRODUCT_CODE_CONFLICT", { ns: "errors" });
    if (field === "weight") return t("validation.weight");
    if (
      field === "acquisitionCostPerGram.amount" ||
      field === "acquisitionCostPerGram.currency"
    )
      return t("validation.cost");
    return t(`validation.${field}`);
  }

  function renderText(field: TextField, error?: FieldError) {
    const id = `create-product-${field}`;
    const registration = form.register(field, {
      onChange: () => {
        if (form.getFieldState(field).invalid) form.clearErrors(field);
        if (
          field === "acquisitionCostPerGram.currency" &&
          form.getFieldState("acquisitionCostPerGram.amount").invalid
        ) {
          form.clearErrors("acquisitionCostPerGram.amount");
        }
      },
    });
    const accessibility = {
      id,
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? `${id}-error` : undefined,
    };
    return (
      <div key={field} className="grid min-w-0 gap-2">
        <Label htmlFor={id}>{t(`formFields.${field}`)}</Label>
        {field === "note" ? (
          <Textarea
            {...registration}
            {...accessibility}
            rows={3}
            readOnly={busy}
            className="min-h-20 w-full rounded-md border border-control-border bg-control px-3 py-2 text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.06)] outline-none placeholder:text-muted-foreground hover:border-control-hover-border focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive dark:hover:border-foreground/40 dark:shadow-none"
          />
        ) : (
          <Input
            {...registration}
            {...accessibility}
            readOnly={busy}
            inputMode={
              field === "weight" ||
              field === "netGoldWeight" ||
              field === "acquisitionCostPerGram.amount"
                ? "decimal"
                : "text"
            }
            enterKeyHint="next"
            autoComplete="off"
            maxLength={
              field === "acquisitionCostPerGram.currency" ? 3 : undefined
            }
            autoCapitalize={
              field === "acquisitionCostPerGram.currency"
                ? "characters"
                : undefined
            }
            className="min-h-11 lg:min-h-9"
          />
        )}
        {error && (
          <p id={`${id}-error`} className="text-xs text-destructive">
            {fieldMessage(error, field)}
          </p>
        )}
      </div>
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
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
        {renderText(
          "acquisitionCostPerGram.amount",
          errors.acquisitionCostPerGram?.amount,
        )}
        {renderText(
          "acquisitionCostPerGram.currency",
          errors.acquisitionCostPerGram?.currency,
        )}
      </div>
      <AcquisitionPreview control={form.control} />
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
  const [weight, rate] = useWatch({
    control,
    name: ["weight", "acquisitionCostPerGram"],
  });
  const preview = parseProductAcquisition({
    weight,
    acquisitionCostPerGram: {
      amount: rate.amount,
      currency: rate.currency.trim().toUpperCase(),
    },
  });

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
