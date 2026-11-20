import { useQuery } from "@tanstack/react-query";
import { Controller, useForm, type FieldError } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { ProductCreateInput, ProductDetail } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
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
import { ProductSelect } from "./ProductSelect";

type TextField =
  | "code"
  | "name"
  | "category"
  | "weight"
  | "acquisitionCost.amount"
  | "acquisitionCost.currency"
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

  return (
    <ProductPanel
      title={t("create")}
      opener={opener}
      close={close}
      busy={create.isPending}
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
        <CreateForm
          currency={currency}
          purities={options.data.purities}
          create={create}
          created={created}
        />
      )}
    </ProductPanel>
  );
}

function CreateForm({
  currency,
  purities,
  create,
  created,
}: {
  currency: string;
  purities: number[];
  create: ReturnType<typeof useCreateProduct>;
  created: (product: ProductDetail) => void;
}) {
  const { t } = useTranslation(["products", "errors"]);
  const form = useForm<ProductFormValues, unknown, ProductCreateInput>({
    resolver: resolveProductForm,
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      code: "",
      name: "",
      category: "",
      purity: "",
      weight: "",
      acquisitionCost: { amount: "", currency },
      note: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const busy = isSubmitting || create.isPending;
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    try {
      created(await create.mutateAsync(values));
    } catch (error) {
      if (error instanceof ApiError) {
        const field = productErrorField(error);
        if (field) {
          form.setError(field, { type: error.code }, { shouldFocus: true });
          return;
        }
      }
      form.setError("root", {
        type:
          error instanceof ApiError
            ? error.isNetwork
              ? "uncertain"
              : error.code
            : "generic",
      });
    }
  });

  function fieldMessage(error: FieldError, field: TextField | "purity") {
    if (error.type === "PRODUCT_CODE_CONFLICT")
      return t("PRODUCT_CODE_CONFLICT", { ns: "errors" });
    if (field === "weight") return t("validation.weight");
    if (
      field === "acquisitionCost.amount" ||
      field === "acquisitionCost.currency"
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
          field === "acquisitionCost.currency" &&
          form.getFieldState("acquisitionCost.amount").invalid
        ) {
          form.clearErrors("acquisitionCost.amount");
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
          <textarea
            {...registration}
            {...accessibility}
            rows={3}
            readOnly={busy}
            className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          />
        ) : (
          <Input
            {...registration}
            {...accessibility}
            readOnly={busy}
            inputMode={
              field === "weight" || field === "acquisitionCost.amount"
                ? "decimal"
                : "text"
            }
            enterKeyHint="next"
            autoComplete="off"
            maxLength={field === "acquisitionCost.currency" ? 3 : undefined}
            autoCapitalize={
              field === "acquisitionCost.currency" ? "characters" : undefined
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
    <form onSubmit={submit} noValidate aria-busy={busy} className="grid gap-4">
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
              <ProductSelect
                id="create-product-purity"
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={field.onChange}
                disabled={busy}
                placeholder={t("choosePurity")}
                invalid={fieldState.invalid}
                describedBy={
                  fieldState.error ? "create-product-purity-error" : undefined
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
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
        {renderText("acquisitionCost.amount", errors.acquisitionCost?.amount)}
        {renderText(
          "acquisitionCost.currency",
          errors.acquisitionCost?.currency,
        )}
      </div>
      {renderText("note", errors.note)}
      {rootError && (
        <p role="alert" className="text-destructive">
          {rootError === "uncertain"
            ? t("createUncertain")
            : t(
                rootError === "INVALID_PRODUCT" ||
                  rootError === "ACCESS_DENIED" ||
                  rootError === "AUTH_UNAVAILABLE"
                  ? rootError
                  : "generic",
                { ns: "errors" },
              )}
        </p>
      )}
      <Button type="submit" className="min-h-11 lg:min-h-9" disabled={busy}>
        {t(busy ? "saving" : "save")}
      </Button>
    </form>
  );
}
