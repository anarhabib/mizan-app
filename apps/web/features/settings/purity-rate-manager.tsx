"use client";
import { useId, useState } from "react";
import { Coins, Gem, History } from "lucide-react";
import type { OldGoldRate, PurityGrade } from "@mizan/contracts";
import type { Locale } from "../language/messages";
import { SettingsForm } from "./settings-form";
import { SettingsSection } from "./settings-section";
import { money } from "../../lib/format-money";
import { settingsCopy } from "./settings-copy";

const currencies = Intl.supportedValuesOf("currency");
const listItem =
  "min-w-0 rounded-xl border border-solid border-mizan-edge bg-mizan-field p-3";

export function PurityRateManager({
  organizationId,
  locale,
  defaultCurrency,
  purities,
  rates,
}: {
  organizationId: string;
  locale: Locale;
  defaultCurrency: string;
  purities: PurityGrade[];
  rates: OldGoldRate[];
}) {
  const copy = settingsCopy[locale];
  const fields = useId();
  const active = purities.filter((grade) => grade.active);
  const [gradeInput, setGradeInput] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [selectedPurity, selectPurity] = useState<number | undefined>(
    active[0]?.value,
  );
  const [currency, selectCurrency] = useState(defaultCurrency);
  const purity = active.some(({ value }) => value === selectedPurity)
    ? selectedPurity
    : active[0]?.value;
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Baku",
  });
  const shared = { organizationId, locale };
  return (
    <>
      <SettingsSection
        title={copy.purities}
        icon={<Gem aria-hidden="true" size={20} />}
      >
        <SettingsForm {...shared} intent="purity" label={copy.add}>
          <label>
            {copy.purity}
            <input
              name="purity"
              inputMode="numeric"
              pattern="[1-9][0-9]{0,2}"
              maxLength={3}
              required
              value={gradeInput}
              onChange={(event) => setGradeInput(event.target.value)}
            />
          </label>
        </SettingsForm>
        <ul>
          {purities.map(({ value, active }) => (
            <li
              key={value}
              className={`flex flex-wrap items-center justify-between gap-2 ${listItem}`}
            >
              <span>
                <strong>{value} ‰</strong> ·{" "}
                {active ? copy.active : copy.inactive}
              </span>
              {active && (
                <SettingsForm
                  {...shared}
                  intent="deactivate"
                  label={copy.deactivate}
                >
                  <input type="hidden" name="purity" value={value} />
                </SettingsForm>
              )}
            </li>
          ))}
        </ul>
      </SettingsSection>
      <SettingsSection
        title={copy.rates}
        icon={<Coins aria-hidden="true" size={20} />}
      >
        {!active.length ? (
          <p>{copy.noActive}</p>
        ) : (
          <SettingsForm {...shared} intent="rate" label={copy.addRate}>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <label htmlFor={`${fields}-grade`}>{copy.purity}</label>
                <select
                  id={`${fields}-grade`}
                  name="purity"
                  required
                  value={purity}
                  onChange={(event) => selectPurity(Number(event.target.value))}
                >
                  {active.map(({ value }) => (
                    <option key={value} value={value}>
                      {value} ‰
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid min-w-0 gap-2">
                <label htmlFor={`${fields}-currency`}>
                  {copy.rateCurrency}
                </label>
                <select
                  id={`${fields}-currency`}
                  name="currency"
                  required
                  value={currency}
                  onChange={(event) => selectCurrency(event.target.value)}
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label>
              {copy.amount}
              <input
                name="amountPerGram"
                inputMode="decimal"
                maxLength={19}
                required
                value={rateInput}
                onChange={(event) => setRateInput(event.target.value)}
              />
            </label>
          </SettingsForm>
        )}
      </SettingsSection>
      <SettingsSection
        title={copy.history}
        icon={<History aria-hidden="true" size={18} />}
      >
        {rates.length === 0 ? (
          <p>{copy.empty}</p>
        ) : (
          <ul>
            {rates.map((rate) => (
              <li key={rate.id} className={`grid gap-1 ${listItem}`}>
                <strong className="wrap-anywhere tabular-nums">
                  {rate.purity} ‰ ·{" "}
                  {money(locale, rate.amountPerGram, rate.currency)}
                </strong>
                <span className="text-sm text-mizan-muted">
                  {rate.current ? copy.current : copy.historical} ·{" "}
                  <time dateTime={rate.effectiveAt}>
                    {date.format(new Date(rate.effectiveAt))}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </>
  );
}
