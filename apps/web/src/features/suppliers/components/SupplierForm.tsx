import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  parseSupplierInput,
  type Supplier,
  type SupplierContactInput,
  type ProductDetail,
} from "@mizan/contracts";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PendingButton } from "@/shared/ui/PendingButton";
import { ProductPanel, productKeys } from "@/features/products";
import { useSaveSupplier, type SupplierScope } from "../api/queries";
import { controlClass, WriteError } from "./ledger";

const contactFields = [
  ["name", 120, "organization"],
  ["contactPerson", 120, "name"],
  ["phone", 40, "tel"],
  ["email", 254, "email"],
  ["address", 500, "street-address"],
  ["taxId", 40, "off"],
  ["note", 1000, "off"],
] as const;

export function SupplierForm({
  scope,
  supplier,
  opener,
  close,
  saved,
}: {
  scope: SupplierScope;
  supplier?: Supplier;
  opener: HTMLElement;
  close: () => void;
  saved: (supplier: Supplier) => void;
}) {
  const { t } = useTranslation("suppliers");
  const id = useId();
  const [error, setError] = useState<unknown>();
  const client = useQueryClient();
  const mutation = useSaveSupplier(scope, supplier?.id);
  const form = useForm<SupplierContactInput>({
    defaultValues: Object.fromEntries(
      contactFields.map(([field]) => [field, supplier?.[field] ?? ""]),
    ),
  });
  const busy = mutation.isPending || form.formState.isSubmitting;
  return (
    <ProductPanel
      title={t(supplier ? "editSupplier" : "addSupplier")}
      opener={opener}
      close={close}
      busy={busy}
    >
      <form
        noValidate
        aria-busy={busy}
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (body) => {
          setError(undefined);
          const parsed = parseSupplierInput(body);
          if ("field" in parsed) {
            if (parsed.field !== "isActive")
              form.setError(
                parsed.field,
                { type: "validate" },
                { shouldFocus: true },
              );
            return;
          }
          try {
            const result = await mutation.mutateAsync(parsed.input);
            if (supplier && supplier.name !== result.name) {
              for (const [
                queryKey,
                product,
              ] of client.getQueriesData<ProductDetail>({
                queryKey: productKeys.details(scope),
              })) {
                if (product?.purchase?.supplierId === result.id)
                  void client.invalidateQueries({ queryKey, exact: true });
              }
            }
            toast.success(t("supplierSaved"));
            saved(result);
          } catch (cause) {
            setError(cause);
          }
        })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {contactFields.map(([field, maxLength, autoComplete]) => {
            const invalid = Boolean(form.formState.errors[field]);
            const props = {
              ...form.register(field),
              id: id + field,
              autoComplete,
              maxLength,
              disabled: busy,
              "aria-invalid": invalid,
              "aria-describedby": invalid ? id + field + "-error" : undefined,
            };
            return (
              <div
                key={field}
                className={`grid min-w-0 gap-2 ${field === "note" ? "sm:col-span-2" : ""}`}
              >
                <Label htmlFor={props.id}>{t(`fields.${field}`)}</Label>
                {field === "note" ? (
                  <Textarea {...props} />
                ) : (
                  <Input
                    {...props}
                    required={field === "name"}
                    type={
                      field === "email"
                        ? "email"
                        : field === "phone"
                          ? "tel"
                          : "text"
                    }
                    className={controlClass}
                  />
                )}
                {invalid && (
                  <p
                    id={props["aria-describedby"]}
                    className="text-destructive"
                  >
                    {t(`invalidContact.${field}`)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <WriteError error={error} />
        <PendingButton type="submit" pending={busy} className={controlClass}>
          {t("save")}
        </PendingButton>
      </form>
    </ProductPanel>
  );
}
