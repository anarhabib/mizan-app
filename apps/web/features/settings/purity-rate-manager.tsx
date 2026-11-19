"use client";
import { useId, useState } from "react";
import { Coins, Gem } from "lucide-react";
import type { PurityGrade } from "@mizan/contracts";
import type { Locale } from "../language/messages";
import { SettingsForm } from "./settings-form";
import { SettingsSection } from "./settings-section";
import { StatusBadge } from "../../components/ui/status-badge";
import { settingsCopy } from "./settings-copy";

export function PurityGrades({
  organizationId,
  locale,
  purities,
}: {
  organizationId: string;
  locale: Locale;
  purities: PurityGrade[];
}) {
  const copy = settingsCopy[locale];
  const [gradeInput, setGradeInput] = useState("");
  const shared = { organizationId, locale };
  return (
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
      <ul className="gap-0! divide-y divide-mizan-edge/40">
        {purities.map(({ value, active }) => (
          <li
            key={value}
            className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2"
          >
            <span className="flex flex-wrap items-center gap-2">
              <strong className="tabular-nums">{value} ‰</strong>
              <StatusBadge muted={!active}>
                {active ? copy.active : copy.inactive}
              </StatusBadge>
            </span>
            <SettingsForm
              {...shared}
              intent={active ? "deactivate" : "reactivate"}
              label={active ? copy.deactivate : copy.reactivate}
              buttonVariant={active ? "secondary" : "primary"}
            >
              <input type="hidden" name="purity" value={value} />
            </SettingsForm>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}

export function PurchaseRates({
  organizationId,
  locale,
  currencies,
  purities,
}: {
  organizationId: string;
  locale: Locale;
  currencies: readonly string[];
  purities: PurityGrade[];
}) {
  const copy = settingsCopy[locale];
  const fields = useId();
  const active = purities.filter((grade) => grade.active);
  const [rateInput, setRateInput] = useState("");
  const [selectedPurity, selectPurity] = useState<number | undefined>(
    active[0]?.value,
  );
  const [currency, selectCurrency] = useState("AZN");
  const purity = active.some(({ value }) => value === selectedPurity)
    ? selectedPurity
    : active[0]?.value;
  const shared = { organizationId, locale };
  return (
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
              <label htmlFor={`${fields}-currency`}>{copy.rateCurrency}</label>
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
  );
}
