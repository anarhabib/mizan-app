import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/shared/lib/api";
import { resources } from "@/shared/lib/i18n";
export function ErrorState({
  error,
  retry,
  pending = false,
}: {
  error: ApiError;
  retry: () => void;
  pending?: boolean;
}) {
  const { t } = useTranslation(["errors", "shell"]);
  const key = Object.hasOwn(resources.az.errors, error.code)
    ? (error.code as keyof typeof resources.az.errors)
    : "generic";
  return (
    <section
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6"
    >
      <p>{t(key, { ns: "errors" })}</p>
      <Button
        onClick={retry}
        disabled={pending}
        className="min-h-11 lg:min-h-9"
      >
        {t("retry", { ns: "shell" })}
      </Button>
    </section>
  );
}
