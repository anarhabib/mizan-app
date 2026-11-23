import { PendingButton } from "@/shared/ui/PendingButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
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
    <Alert
      variant="destructive"
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg p-6"
    >
      <AlertDescription>{t(key, { ns: "errors" })}</AlertDescription>
      <PendingButton
        pending={pending}
        onClick={retry}
        className="min-h-11 lg:min-h-9"
      >
        {!pending && <RotateCw aria-hidden="true" />}
        {t("retry", { ns: "shell" })}
      </PendingButton>
    </Alert>
  );
}
