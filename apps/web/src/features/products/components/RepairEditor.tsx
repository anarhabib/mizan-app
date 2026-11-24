import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  parseRepairCommand,
  supplierPaymentMethods,
  type ProductDetail,
  type RepairCommand,
  type SupplierOption,
  type SupplierPaymentMethod,
} from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarDate,
  formatPayable,
  SupplierPicker,
  todayInBaku,
} from "@/features/suppliers";
import type { ApiError } from "@/shared/lib/api";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { PendingButton } from "@/shared/ui/PendingButton";
import type { ProductScope } from "../api/queries";
import { gemstoneFormDefaults, type ProductFormValues } from "../lib/form";
import { GemstoneFields, ProductTextField } from "./ProductFormFields";
import {
  RepairMeasurementSnapshot,
  type RepairEditorView,
} from "./ProductRepairs";

type RepairValues = {
  description: string;
  repairerName: string;
  sentDate: string;
  expectedReturnDate: string;
  completedDate: string;
  paymentDate: string;
  method: SupplierPaymentMethod;
  currency: string;
  amount: string;
  weight: string;
  netGoldWeight: string;
  gemstones: ProductFormValues["gemstones"];
  note: string;
};

const decimal = (value: string) => value.trim().replace(",", ".");

function buildCommand(
  view: RepairEditorView,
  values: RepairValues,
  supplier?: SupplierOption,
) {
  const { action } = view;
  const note = values.note.trim() || undefined;
  const cost = { amount: decimal(values.amount), currency: values.currency };
  if (action === "send")
    return {
      action,
      note,
      description: values.description,
      ...(supplier
        ? { supplierId: supplier.id }
        : { repairerName: values.repairerName }),
      sentDate: values.sentDate,
      expectedReturnDate: values.expectedReturnDate || undefined,
      estimatedCost: cost.amount ? cost : undefined,
    };
  const repairId = view.repair.id;
  if (action === "complete")
    return {
      action,
      repairId,
      note,
      completedDate: values.completedDate,
      actualCost: cost,
      weight: decimal(values.weight),
      netGoldWeight: decimal(values.netGoldWeight),
      gemstones:
        values.gemstones?.map((group) => ({
          ...group,
          stoneCount: /^\d+$/.test(group.stoneCount.trim())
            ? Number(group.stoneCount)
            : NaN,
          totalCarats: decimal(group.totalCarats ?? "") || undefined,
          individualCarats: decimal(group.individualCarats ?? "") || undefined,
        })) ?? [],
    };
  if (action === "pay")
    return {
      action,
      repairId,
      method: values.method,
      paymentDate: values.paymentDate,
    };
  return { action, repairId, note };
}

export function RepairEditor({
  view,
  product,
  scope,
  id,
  pending,
  error,
  defaultCurrency,
  currencies,
  onBack,
  save,
}: {
  view: RepairEditorView;
  product: ProductDetail;
  scope: ProductScope;
  id: string;
  pending: boolean;
  error: ApiError | null;
  defaultCurrency: string;
  currencies: string[];
  onBack: () => void;
  save: (command: RepairCommand) => Promise<void>;
}) {
  const { t, i18n } = useTranslation(["products", "sales", "errors"]);
  const { action } = view;
  const heading = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const [supplier, setSupplier] = useState<SupplierOption>();
  const today = todayInBaku();
  const repair = action === "send" ? undefined : view.repair;
  const before = repair?.before ?? {
    weight: product.weight,
    netGoldWeight: product.netGoldWeight ?? null,
    gemstones: product.gemstones ?? [],
  };
  const estimatedCurrency = repair?.financial?.estimatedCost?.currency;
  const form = useForm<RepairValues>({
    defaultValues: {
      description: "",
      repairerName: "",
      note: "",
      amount: "",
      expectedReturnDate: "",
      sentDate: today,
      completedDate: today,
      paymentDate: today,
      method: "CASH",
      currency:
        estimatedCurrency && currencies.includes(estimatedCurrency)
          ? estimatedCurrency
          : defaultCurrency,
      weight: before.weight,
      netGoldWeight: before.netGoldWeight ?? "",
      gemstones: before.gemstones.map(gemstoneFormDefaults),
    },
  });
  const { errors } = form.formState;
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  function markError(field: string) {
    const mapped =
      field === "estimatedCost" || field === "actualCost" ? "amount" : field;
    if (mapped in form.getValues() || /^gemstones\.\d+\.\w+$/.test(mapped)) {
      const name = mapped as FieldPath<RepairValues>;
      form.setError(
        name,
        {
          message: t(`repairs.validation.${mapped}`, {
            defaultValue: t("repairs.validation.generic"),
          }),
        },
        { shouldFocus: true },
      );
    } else {
      form.setError("root", { message: t("repairs.validation.generic") });
    }
  }

  function dateField(
    name: "sentDate" | "expectedReturnDate" | "completedDate" | "paymentDate",
    min?: string,
  ) {
    const fieldId = `${id}-${name}`;
    const message = errors[name]?.message;
    return (
      <div className="grid min-w-0 content-start gap-2">
        <Label htmlFor={fieldId}>{t(`repairs.${name}`)}</Label>
        <Input
          id={fieldId}
          type="date"
          min={min ?? "0001-01-01"}
          max={name === "expectedReturnDate" ? "9999-12-31" : today}
          readOnly={pending}
          required={name !== "expectedReturnDate"}
          aria-invalid={Boolean(message)}
          aria-describedby={message ? `${fieldId}-error` : undefined}
          className="min-h-11 min-w-0 lg:min-h-9"
          {...form.register(name, { onChange: () => form.clearErrors(name) })}
        />
        {message && (
          <p id={`${fieldId}-error`} className="text-xs text-destructive">
            {message}
          </p>
        )}
      </div>
    );
  }

  function selectField(
    name: "currency" | "method",
    label: string,
    options: { value: string; label: string }[],
  ) {
    const fieldId = `${id}-${name}`;
    return (
      <div className="grid min-w-0 content-start gap-2">
        <Label htmlFor={fieldId}>{label}</Label>
        <Controller
          name={name}
          control={form.control}
          render={({ field }) => (
            <OptionSelect
              id={fieldId}
              ref={field.ref}
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
              disabled={pending}
              options={options}
            />
          )}
        />
      </div>
    );
  }

  const actualCost = repair?.financial?.actualCost;
  const formSentDate = useWatch({ control: form.control, name: "sentDate" });
  const sentDate = action === "send" ? formSentDate : repair?.sentDate;
  async function submit(values: RepairValues) {
    if (inFlight.current || pending) return;
    const parsed = parseRepairCommand(buildCommand(view, values, supplier));
    if ("field" in parsed) {
      markError(parsed.field);
      return;
    }
    inFlight.current = true;
    try {
      await save(parsed.command);
    } catch {
      // The mutation exposes a localized error and retains the attempt key when needed.
    } finally {
      inFlight.current = false;
    }
  }
  return (
    <form
      id={id}
      className="grid min-w-0 gap-4"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <p ref={heading} tabIndex={-1} className="wrap-anywhere font-medium">
        {product.code} · {product.name}
      </p>
      {action === "send" && (
        <>
          <ProductTextField
            form={form}
            name="description"
            label={t("repairs.description")}
            error={errors.description?.message}
            busy={pending}
            multiline
          />
          <SupplierPicker
            scope={scope}
            value={supplier}
            onChange={setSupplier}
            disabled={pending}
            label={t("repairs.supplier")}
          />
          {!supplier && (
            <ProductTextField
              form={form}
              name="repairerName"
              label={t("repairs.repairer")}
              error={errors.repairerName?.message}
              busy={pending}
            />
          )}
          <div className="grid min-w-0 gap-3 min-[390px]:grid-cols-2">
            {dateField("sentDate")}
            {dateField("expectedReturnDate", sentDate)}
          </div>
        </>
      )}
      {(action === "send" || action === "complete") && (
        <RepairMeasurementSnapshot
          label={t("repairs.before")}
          measurement={before}
        />
      )}
      {action === "complete" && (
        <>
          {dateField("completedDate", sentDate)}
          <fieldset className="grid min-w-0 gap-3">
            <legend className="mb-2 font-medium">{t("repairs.after")}</legend>
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <ProductTextField
                form={form}
                name="weight"
                label={t("formFields.weight")}
                error={errors.weight?.message}
                busy={pending}
                decimal
              />
              <ProductTextField
                form={form}
                name="netGoldWeight"
                label={t("repairs.netGoldWeight")}
                error={errors.netGoldWeight?.message}
                busy={pending}
                decimal
              />
            </div>
            <GemstoneFields form={form} busy={pending} />
          </fieldset>
        </>
      )}
      {(action === "send" || action === "complete") && (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
          <ProductTextField
            form={form}
            name="amount"
            error={errors.amount?.message}
            busy={pending}
            decimal
            label={t(
              action === "send"
                ? "repairs.estimatedCostOptional"
                : "repairs.actualCost",
            )}
          />
          {selectField(
            "currency",
            t("repairs.currency"),
            currencies.map((currency) => ({
              value: currency,
              label: currency,
            })),
          )}
        </div>
      )}
      {action === "cancel" && <p>{t("repairs.cancelDescription")}</p>}
      {action === "pay" && actualCost && (
        <>
          <p>
            {t("repairs.fullPayment", {
              amount: formatPayable(actualCost, i18n.resolvedLanguage ?? "az"),
            })}
          </p>
          <p className="text-muted-foreground">
            {t("repairs.sentDate")} ·{" "}
            <CalendarDate value={view.repair.sentDate} />
          </p>
          {dateField("paymentDate", sentDate)}
          {selectField(
            "method",
            t("repairs.method"),
            supplierPaymentMethods.map((method) => ({
              value: method,
              label: t(`methods.${method}`, { ns: "sales" }),
            })),
          )}
        </>
      )}
      {action !== "pay" && (
        <ProductTextField
          form={form}
          name="note"
          label={t(
            action === "progress" ? "repairs.progressNote" : "repairs.note",
          )}
          error={errors.note?.message}
          busy={pending}
          multiline
        />
      )}
      {errors.root?.message && (
        <p role="alert" className="text-destructive">
          {errors.root.message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error.code === "INVALID_REPAIR" && error.field
            ? t(`repairs.validation.${error.field}`, {
                defaultValue: t("repairs.validation.generic"),
              })
            : t(error.code, {
                ns: "errors",
                defaultValue: t("generic", { ns: "errors" }),
              })}
        </p>
      )}
      <div className="hidden gap-2 lg:flex">
        <RepairSubmit id={id} action={action} pending={pending} />
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onBack}
        >
          {t("repairs.back")}
        </Button>
      </div>
    </form>
  );
}

export function RepairSubmit({
  id,
  action,
  pending,
}: {
  id: string;
  action: RepairEditorView["action"];
  pending: boolean;
}) {
  const { t } = useTranslation("products");
  return (
    <PendingButton
      type="submit"
      form={id}
      pending={pending}
      className="min-h-11 whitespace-normal lg:min-h-9"
    >
      {t(`repairs.actions.${action}`)}
    </PendingButton>
  );
}
