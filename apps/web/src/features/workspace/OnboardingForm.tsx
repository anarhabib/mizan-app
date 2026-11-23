import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import {
  maxFullNameLength,
  parseFullName,
  parseOnboarding,
  type OnboardingRequest,
} from "@mizan/contracts";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AuthPanel, SignOutButton, useSession } from "@/features/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/shared/lib/api";
import { createWorkspace } from "./api";
import type { StoreScope } from "./selection";

const fields = [
  "fullName",
  "organizationName",
  "storeName",
  "defaultCurrency",
] as const;

export function OnboardingForm({
  onCreated,
  reloadContexts,
  fullName,
}: {
  fullName: string | null;
  onCreated: (scope: StoreScope) => void;
  reloadContexts: () => Promise<unknown>;
}) {
  const { t } = useTranslation(["workspace", "errors", "auth"]);
  const { suggestedName } = useSession();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingRequest>({
    defaultValues: {
      fullName: fullName ?? suggestedName ?? "",
      organizationName: "",
      storeName: "",
      defaultCurrency: "",
    },
  });
  const mutation = useMutation({ mutationFn: createWorkspace });

  async function submit(values: OnboardingRequest) {
    clearErrors("root");
    const parsed = parseOnboarding({
      ...values,
      defaultCurrency: values.defaultCurrency.trim().toUpperCase(),
    });
    if (!parsed) {
      setError("root", { message: t("INVALID_ONBOARDING", { ns: "errors" }) });
      return;
    }
    try {
      onCreated(await mutation.mutateAsync(parsed));
      toast.success(t("created"));
      await reloadContexts();
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.isNetwork || error.status >= 500)
      ) {
        await reloadContexts();
      }
      const code = error instanceof ApiError ? error.code : "";
      const key =
        code === "INVALID_ONBOARDING" ||
        code === "NETWORK_ERROR" ||
        code === "AUTH_UNAVAILABLE" ||
        code === "UNAUTHENTICATED"
          ? code
          : "generic";
      setError("root", { message: t(key, { ns: "errors" }) });
    }
  }

  return (
    <AuthPanel title={t("onboarding")}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => void handleSubmit(submit)(event)}
      >
        {fields.map((field) => (
          <div className="grid gap-2" key={field}>
            <Label htmlFor={field}>
              {field === "fullName" ? t("fullName", { ns: "auth" }) : t(field)}
            </Label>
            <Input
              id={field}
              className="min-h-11 lg:min-h-9"
              autoCapitalize={
                field === "defaultCurrency" ? "characters" : undefined
              }
              placeholder={
                field === "defaultCurrency" ? t("currencyExample") : undefined
              }
              autoComplete={field === "fullName" ? "name" : undefined}
              readOnly={field === "fullName" && !!fullName}
              maxLength={
                field === "defaultCurrency"
                  ? 3
                  : field === "fullName"
                    ? maxFullNameLength
                    : 100
              }
              aria-invalid={!!errors[field]}
              aria-describedby={errors[field] ? `${field}-error` : undefined}
              {...register(field, {
                validate: (value) =>
                  field === "fullName"
                    ? !!parseFullName(value) || t("invalidName", { ns: "auth" })
                    : !!value.trim() || t("required"),
              })}
            />
            {errors[field] && (
              <p className="text-destructive" id={`${field}-error`}>
                {errors[field]?.message}
              </p>
            )}
          </div>
        ))}
        {errors.root && (
          <p role="alert" className="text-destructive">
            {errors.root.message}
          </p>
        )}
        <PendingButton pending={isSubmitting} className="min-h-11 lg:min-h-9">
          {t(isSubmitting ? "creating" : "create")}
        </PendingButton>
      </form>
      <div className="self-start">
        <SignOutButton />
      </div>
    </AuthPanel>
  );
}
