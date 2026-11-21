import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resolvePurityForm,
  resolveRateForm,
  type PurityInput,
  type RateInput,
  type RateValues,
} from "../lib/form";

export function PurityForm({
  busy,
  save,
}: {
  busy: boolean;
  save: (body: PurityInput) => Promise<boolean>;
}) {
  const { t } = useTranslation("settings");
  const form = useForm<{ value: string }, unknown, PurityInput>({
    resolver: resolvePurityForm,
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: { value: "" },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <form
      onSubmit={form.handleSubmit(async (body) => {
        if (await save(body)) form.reset();
      })}
    >
      <fieldset
        disabled={busy || isSubmitting}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="grid w-28 gap-2">
          <Label htmlFor="settings-new-purity">{t("purity")}</Label>
          <Input
            id="settings-new-purity"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            className="min-h-10 lg:min-h-8"
            aria-invalid={!!errors.value}
            aria-describedby={
              errors.value ? "settings-purity-error" : undefined
            }
            {...form.register("value")}
          />
        </div>
        <Button type="submit" className="min-h-10 lg:min-h-8">
          <Plus aria-hidden="true" />
          {t("addPurity")}
        </Button>
      </fieldset>
      {errors.value && (
        <p
          id="settings-purity-error"
          role="alert"
          className="mt-2 text-destructive"
        >
          {t("invalidPurity")}
        </p>
      )}
    </form>
  );
}

export function RateForm({
  currency,
  purities,
  busy,
  save,
}: {
  currency: string;
  purities: number[];
  busy: boolean;
  save: (rate: RateInput) => Promise<boolean>;
}) {
  const { t } = useTranslation("settings");
  const form = useForm<RateValues, unknown, RateInput>({
    resolver: resolveRateForm,
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: { purity: "", currency, amountPerGram: "" },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <form
      onSubmit={form.handleSubmit(async (body) => {
        if (await save(body)) form.resetField("amountPerGram");
      })}
    >
      <fieldset
        disabled={busy || isSubmitting}
        className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
      >
        <div className="grid gap-2">
          <Label htmlFor="settings-rate-purity">{t("purity")}</Label>
          <select
            id="settings-rate-purity"
            className="h-10 w-full rounded-md border border-control-border bg-control px-2 text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.06)] outline-none hover:border-control-hover-border focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive dark:hover:border-foreground/40 dark:shadow-none lg:h-8"
            aria-invalid={!!errors.purity}
            aria-describedby={
              errors.purity ? "settings-rate-purity-error" : undefined
            }
            {...form.register("purity")}
          >
            <option value="">{t("choosePurity")}</option>
            {purities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {errors.purity && (
            <p
              id="settings-rate-purity-error"
              role="alert"
              className="text-destructive"
            >
              {t("invalidPurity")}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="settings-rate-currency">{t("currency")}</Label>
          <Input
            id="settings-rate-currency"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={3}
            className="min-h-10 lg:min-h-8"
            aria-invalid={!!errors.currency}
            aria-describedby={
              errors.currency ? "settings-rate-currency-error" : undefined
            }
            {...form.register("currency")}
          />
          {errors.currency && (
            <p
              id="settings-rate-currency-error"
              role="alert"
              className="text-destructive"
            >
              {t("invalidCurrency")}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="settings-rate-amount">{t("amountPerGram")}</Label>
          <Input
            id="settings-rate-amount"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            className="min-h-10 tabular-nums lg:min-h-8"
            aria-invalid={!!errors.amountPerGram}
            aria-describedby={
              errors.amountPerGram ? "settings-rate-amount-error" : undefined
            }
            {...form.register("amountPerGram")}
          />
          {errors.amountPerGram && (
            <p
              id="settings-rate-amount-error"
              role="alert"
              className="text-destructive"
            >
              {t("invalidRate")}
            </p>
          )}
        </div>
        <Button type="submit" className="min-h-10 sm:mt-6 lg:min-h-8">
          <Plus aria-hidden="true" />
          {t("addRate")}
        </Button>
      </fieldset>
    </form>
  );
}
