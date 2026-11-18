"use client";

import { useActionState } from "react";
import type { ProductCreateInput } from "@mizan/contracts";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import type { Locale } from "../language/messages";
import {
  productCopy,
  type ProductScope,
  type ProductOptions,
} from "./product-copy";

export type ProductFormState = {
  field?: keyof ProductCreateInput;
  duplicate?: boolean;
  failed?: boolean;
  revision?: number;
  values?: Record<string, string>;
};

export function ProductForm({
  locale,
  scope,
  options,
  save,
  initial = {},
}: {
  locale: Locale;
  scope: ProductScope;
  options: ProductOptions;
  initial?: ProductFormState;
  save: (state: ProductFormState, data: FormData) => Promise<ProductFormState>;
}) {
  const [state, action, pending] = useActionState(save, initial);
  const copy = productCopy[locale];
  const error = (field: keyof ProductCreateInput) =>
    state.field === field
      ? state.duplicate
        ? copy.duplicate
        : copy.invalid
      : undefined;
  const select =
    "min-h-11 rounded-xl border border-mizan-edge bg-mizan-field px-3 text-mizan-ink";
  return (
    <form action={action} className="grid max-w-2xl gap-4" aria-busy={pending}>
      <input type="hidden" name="organizationId" value={scope.organizationId} />
      <input type="hidden" name="storeId" value={scope.storeId} />
      <div key={state.revision} className="grid gap-4 sm:grid-cols-2">
        {(["code", "name", "category"] as const).map((field) => (
          <Field
            key={field}
            id={field}
            name={field}
            label={copy[field]}
            defaultValue={state.values?.[field]}
            error={error(field)}
            required
          />
        ))}
        <label className="grid gap-1.5 text-sm font-bold" htmlFor="purity">
          {copy.purity}
          <select
            className={select}
            id="purity"
            name="purity"
            required
            defaultValue={state.values?.purity ?? ""}
            aria-invalid={Boolean(error("purity"))}
            aria-describedby={error("purity") ? "purity-error" : undefined}
          >
            <option value="" disabled>
              —
            </option>
            {options.purities.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
          {error("purity") && <span id="purity-error">{error("purity")}</span>}
        </label>
        <Field
          id="weight"
          name="weight"
          label={copy.weight}
          inputMode="decimal"
          defaultValue={state.values?.weight}
          error={error("weight")}
          required
        />
        <Field
          id="acquisitionCost"
          name="acquisitionCost"
          label={copy.acquisitionCost}
          inputMode="decimal"
          defaultValue={state.values?.acquisitionCost}
          error={error("acquisitionCost")}
          required
        />
        <label className="grid gap-1.5 text-sm font-bold">
          {copy.currency}
          <select
            className={select}
            name="currency"
            defaultValue={state.values?.currency ?? options.defaultCurrency}
          >
            {Intl.supportedValuesOf("currency").map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <Field
          id="note"
          name="note"
          label={copy.note}
          defaultValue={state.values?.note}
          error={error("note")}
        />
      </div>
      {state.failed && <p role="alert">{copy.failed}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? copy.saving : copy.save}
      </Button>
    </form>
  );
}
