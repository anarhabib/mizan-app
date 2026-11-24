import {
  useEffect,
  useId,
  useImperativeHandle,
  useState,
  type Ref,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Copy, Settings2, Trash2 } from "lucide-react";
import type { ProductCreateInput } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/shared/lib/api";
import {
  productErrorField,
  productWithCurrency,
  resolveProductForm,
  type ProductFormValues,
} from "../lib/form";
import { photoAccept } from "../lib/photo";
import { previewProduct, type ProductPreview } from "../lib/registration";
import { ProductFields, type useProductCategories } from "./ProductForm";

export type RowHandle = {
  validate: () => Promise<ProductCreateInput | undefined>;
  showError: (error: ApiError | string) => void;
  photo: () => File | undefined;
  collapse: () => void;
};

export function ProductRegistrationRow({
  ref,
  rowId,
  number,
  defaults,
  bulk,
  busy,
  sharedCurrency,
  categories,
  purities,
  onPreview,
  onDuplicate,
  onRemove,
  onUseDefaults,
  canAdd,
  canRemove,
}: {
  ref: Ref<RowHandle>;
  rowId: string;
  number: number;
  defaults: ProductFormValues;
  bulk: boolean;
  busy: boolean;
  sharedCurrency?: string;
  categories: ReturnType<typeof useProductCategories>;
  purities: number[];
  onPreview: (rowId: string, preview: ProductPreview) => void;
  onDuplicate: (draft: ProductFormValues) => void;
  onRemove: () => void;
  onUseDefaults: (draft: ProductFormValues) => void;
  canAdd: boolean;
  canRemove: boolean;
}) {
  const { t } = useTranslation(["products", "errors"]);
  const photoId = useId();
  const [open, setOpen] = useState(true);
  const [photo, setPhoto] = useState<File>();
  const [rowError, setRowError] = useState<string>();
  const form = useForm<ProductFormValues, unknown, ProductCreateInput>({
    defaultValues: defaults,
    resolver: (values) =>
      resolveProductForm(productWithCurrency(values, sharedCurrency)),
    mode: "onBlur",
  });
  const values = useWatch({ control: form.control }) as ProductFormValues;
  const { cost, gross, net } = previewProduct(values, sharedCurrency);
  const amount = cost?.amount;
  const currency = cost?.currency;
  useEffect(() => {
    onPreview(rowId, {
      gross,
      net,
      cost: amount && currency ? { amount, currency } : undefined,
    });
  }, [onPreview, rowId, gross, net, amount, currency]);

  useImperativeHandle(ref, () => ({
    photo: () => photo,
    collapse: () => setOpen(false),
    async validate() {
      setRowError(undefined);
      let result: ProductCreateInput | undefined;
      await form.handleSubmit(
        (input) => {
          result = input;
        },
        () => {
          setOpen(true);
          setRowError(t("registration.rowError"));
        },
      )();
      return result;
    },
    showError(error) {
      setOpen(true);
      if (typeof error === "string") {
        setRowError(error);
        return;
      }
      const field = productErrorField(error);
      if (field) form.setError(field, { type: error.code });
      setRowError(
        t(
          error.code === "INVALID_PRODUCT"
            ? "registration.rowError"
            : error.code,
          {
            ns: error.code === "INVALID_PRODUCT" ? "products" : "errors",
            defaultValue: t("registration.rowError"),
          },
        ),
      );
    },
  }));

  return (
    <details
      open={!bulk || open}
      onToggle={(event) => {
        if (bulk) setOpen(event.currentTarget.open);
      }}
      className={bulk ? "min-w-0 rounded-md border px-3" : "min-w-0"}
    >
      <summary
        className={
          bulk
            ? "min-h-11 cursor-pointer content-center wrap-anywhere font-medium lg:min-h-9"
            : "hidden"
        }
      >
        {t("registration.productRow", { number })}
        {values.code && (
          <span className="text-muted-foreground"> · {values.code}</span>
        )}
        {rowError && (
          <span className="text-destructive">
            {" "}
            · {t("registration.rowError")}
          </span>
        )}
      </summary>
      <div className={bulk ? "grid gap-4 py-3" : "grid gap-4"}>
        {bulk && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !canAdd}
              onClick={() => onDuplicate(form.getValues())}
            >
              <Copy aria-hidden="true" /> {t("registration.duplicate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onUseDefaults(form.getValues())}
            >
              <Settings2 aria-hidden="true" /> {t("registration.useDefaults")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !canRemove}
              onClick={onRemove}
            >
              <Trash2 aria-hidden="true" /> {t("registration.remove")}
            </Button>
          </div>
        )}
        {rowError && (
          <p role="alert" className="text-destructive">
            {rowError}
          </p>
        )}
        <ProductFields
          {...{ form, categories, purities, busy, sharedCurrency }}
        />
        <div className="grid gap-2">
          <Label htmlFor={photoId}>{t("registration.photo")}</Label>
          <Input
            id={photoId}
            type="file"
            accept={photoAccept}
            disabled={busy}
            onChange={(event) => setPhoto(event.target.files?.[0])}
          />
        </div>
      </div>
    </details>
  );
}
