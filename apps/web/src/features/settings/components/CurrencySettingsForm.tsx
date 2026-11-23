import { PendingButton } from "@/shared/ui/PendingButton";
import { OptionSelect } from "@/shared/ui/OptionSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { useId, useState } from "react";
import {
  checkoutCurrencies,
  configuredCurrencies,
  type CurrencySettings,
  type OrganizationSettings,
} from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";

export function CurrencySettingsForm({
  settings,
  busy,
  saving,
  error,
  save,
}: {
  settings: OrganizationSettings;
  busy: boolean;
  saving: boolean;
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
            <OptionSelect
              id={id}
              disabled={busy}
              value={defaultCurrency}
              onChange={(code) => {
                setDefaultCurrency(code);
                setSelected((current) =>
                  current.includes(code) ? current : [...current, code],
                );
              }}
              options={choices.map((code) => ({ value: code, label: code }))}
            />
          </div>
          <fieldset className="flex flex-wrap gap-x-4">
            <legend className="font-medium">{t("currencies.payment")}</legend>
            {choices.map((code) => (
              <label key={code} className="flex min-h-11 items-center gap-2">
                <Checkbox
                  checked={selected.includes(code)}
                  disabled={busy || code === defaultCurrency}
                  onCheckedChange={(enabled) => {
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
          <PendingButton
            pending={saving}
            type="submit"
            className="min-h-11 justify-self-start lg:min-h-9"
          >
            {t("currencies.save")}
          </PendingButton>
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
