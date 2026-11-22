import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolvePurityForm, type PurityInput } from "../lib/form";

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
