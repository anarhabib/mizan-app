import { useId, useState } from "react";
import {
  checkoutCurrencies,
  configuredCurrencies,
  type CurrencySettings,
  type OrganizationSettings,
} from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function CurrencySettingsForm({
  settings,
  busy,
  error,
  save,
}: {
  settings: OrganizationSettings;
  busy: boolean;
  error?: string;
  save: (body: CurrencySettings) => void;
}) {
  const { t } = useTranslation("settings");
  const id = useId();
  const [defaultCurrency, setDefaultCurrency] = useState(
    settings.defaultCurrency,
  );
  const [selected, setSelected] = useState(() => checkoutCurrencies(settings));
  const choices = [
    ...new Set([
      ...configuredCurrencies,
      settings.defaultCurrency,
      ...selected,
    ]),
  ];
  return (
    <section
      className="grid gap-4 rounded-lg border bg-card p-4"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className="font-heading text-base font-semibold">
        {t("currencies.title")}
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save({
            defaultCurrency,
            paymentCurrencies: choices.filter((code) =>
              selected.includes(code),
            ),
          });
        }}
      >
        <fieldset disabled={busy} className="grid gap-3">
          <div className="grid max-w-48 gap-2">
            <Label htmlFor={id}>{t("currencies.default")}</Label>
            <select
              id={id}
              className="h-11 rounded-md border border-control-border bg-control px-2 lg:h-9"
              value={defaultCurrency}
              onChange={(event) => {
                const code = event.target.value;
                setDefaultCurrency(code);
                setSelected((current) =>
                  current.includes(code) ? current : [...current, code],
                );
              }}
            >
              {choices.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="flex flex-wrap gap-x-4">
            <legend className="font-medium">{t("currencies.payment")}</legend>
            {choices.map((code) => (
              <label key={code} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(code)}
                  disabled={code === defaultCurrency}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setSelected((current) =>
                      enabled
                        ? [...current, code]
                        : current.filter((entry) => entry !== code),
                    );
                  }}
                />
                {code}
              </label>
            ))}
          </fieldset>
          <Button
            type="submit"
            className="min-h-11 justify-self-start lg:min-h-9"
          >
            {t("currencies.save")}
          </Button>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </fieldset>
      </form>
    </section>
  );
}
