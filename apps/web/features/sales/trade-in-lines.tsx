import { Plus } from "lucide-react";
import { Button, focusClass } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import type { Locale } from "../language/messages";
import { productCopy } from "../products/product-copy";
import { saleCopy, type SaleOptions } from "./sale-copy";
import { tradeValue } from "./settlement";
import { money } from "./settlement-summary";

export type TradeDraft = {
  id: string;
  purity: number;
  weight: string;
  overrideAmount: string;
};

export function TradeInLines({
  locale,
  options,
  lines,
  onChange,
}: {
  locale: Locale;
  options: SaleOptions;
  lines: TradeDraft[];
  onChange: (lines: TradeDraft[]) => void;
}) {
  const copy = saleCopy[locale];
  const product = productCopy[locale];
  return (
    <section className="grid gap-3">
      <h2>{copy.trade}</h2>
      {lines.map((line) => {
        const rate = options.rates.find(
          (entry) => entry.purity === line.purity,
        );
        let calculated: string | undefined;
        try {
          if (rate) calculated = tradeValue(line.weight, rate.amountPerGram);
        } catch {
          // A partial weight entry has no calculated value yet.
        }
        function update(values: Partial<TradeDraft>) {
          onChange(
            lines.map((entry) =>
              entry.id === line.id ? { ...entry, ...values } : entry,
            ),
          );
        }
        return (
          <fieldset
            key={line.id}
            className="grid min-w-0 gap-3 rounded-xl border border-mizan-edge p-3"
          >
            <legend className="px-1 text-sm font-bold">{copy.trade}</legend>
            <div className="grid gap-1.5">
              <label
                htmlFor={line.id + "-purity"}
                className="text-sm font-bold"
              >
                {product.purity}
              </label>
              <select
                id={line.id + "-purity"}
                value={line.purity}
                onChange={(event) =>
                  update({ purity: Number(event.target.value) })
                }
                className={selectClass}
              >
                {!rate && (
                  <option value={line.purity} disabled>
                    {line.purity}
                  </option>
                )}
                {options.rates.map(({ purity }) => (
                  <option key={purity} value={purity}>
                    {purity}
                  </option>
                ))}
              </select>
            </div>
            <Field
              id={line.id + "-weight"}
              inputMode="decimal"
              label={product.weight}
              value={line.weight}
              onChange={(event) => update({ weight: event.target.value })}
            />
            {rate && (
              <p>
                {copy.rate} ·{" "}
                {money(locale, rate.amountPerGram, options.currency)}
              </p>
            )}
            {calculated && (
              <p>
                {copy.calculated} ·{" "}
                {money(locale, calculated, options.currency)}
              </p>
            )}
            <Field
              id={line.id + "-override"}
              inputMode="decimal"
              label={copy.override + " (" + options.currency + ")"}
              value={line.overrideAmount}
              onChange={(event) =>
                update({ overrideAmount: event.target.value })
              }
            />
            <Button
              variant="secondary"
              className="w-fit"
              onClick={() =>
                onChange(lines.filter((entry) => entry.id !== line.id))
              }
            >
              {copy.remove}
            </Button>
          </fieldset>
        );
      })}
      {options.rates.length ? (
        <Button
          variant="secondary"
          className="w-fit"
          disabled={lines.length >= 100}
          onClick={() =>
            onChange([
              ...lines,
              {
                id: crypto.randomUUID(),
                purity: options.rates[0].purity,
                weight: "",
                overrideAmount: "",
              },
            ])
          }
        >
          <Plus size={18} aria-hidden />
          {copy.add}
        </Button>
      ) : (
        <p>{copy.noRates}</p>
      )}
    </section>
  );
}

export const selectClass =
  "min-h-11 min-w-0 rounded-xl border border-mizan-edge bg-mizan-field px-3 text-base text-mizan-ink " +
  focusClass;
