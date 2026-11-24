import { useId } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { maxFullNameLength, parseFullName } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resources } from "@/shared/lib/i18n";
import { PendingButton } from "@/shared/ui/PendingButton";
import { AuthPanel } from "./AuthPanel";
import { SignOutButton } from "./SignOutButton";
import { useSaveProfile } from "./profile";
import { useSession } from "./session";

export function ProfileForm({
  userId,
  fullName,
  edited,
  cancel,
}: {
  userId: string;
  fullName: string;
  edited?: () => void;
  cancel?: () => void;
}) {
  const { t } = useTranslation(["auth", "errors"]);
  const id = useId();
  const save = useSaveProfile(userId);
  const errorKey =
    save.error && Object.hasOwn(resources.az.errors, save.error.code)
      ? (save.error.code as keyof typeof resources.az.errors)
      : "generic";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { fullName },
  });
  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(event) =>
        void handleSubmit(async (values) => {
          const name = parseFullName(values.fullName);
          if (!name || save.isPending) return;
          try {
            await save.mutateAsync(name);
            if (edited) {
              toast.success(t("profileSaved"));
              edited();
            }
          } catch {
            // The mutation error remains visible beside the form.
          }
        })(event)
      }
    >
      <div className="grid gap-2">
        <Label htmlFor={id}>{t("fullName")}</Label>
        <Input
          id={id}
          autoComplete="name"
          maxLength={maxFullNameLength}
          className="min-h-11 lg:min-h-9"
          aria-invalid={!!errors.fullName}
          aria-describedby={errors.fullName ? `${id}-error` : undefined}
          {...register("fullName", {
            validate: (name) => !!parseFullName(name) || t("invalidName"),
          })}
        />
        {errors.fullName && (
          <p id={`${id}-error`} className="text-destructive">
            {errors.fullName.message}
          </p>
        )}
      </div>
      {save.error && (
        <p role="alert" className="text-destructive">
          {t(errorKey, { ns: "errors" })}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {cancel && (
          <Button
            variant="outline"
            type="button"
            className="min-h-11 lg:min-h-9"
            disabled={isSubmitting}
            onClick={cancel}
          >
            {t("cancel")}
          </Button>
        )}
        <PendingButton
          type="submit"
          className="min-h-11 lg:min-h-9"
          pending={isSubmitting}
        >
          {t(edited ? "saveProfile" : "confirmName")}
        </PendingButton>
      </div>
    </form>
  );
}

export function ProfileCompletion({ userId }: { userId: string }) {
  const { t } = useTranslation("auth");
  const { suggestedName } = useSession();
  return (
    <AuthPanel title={t("completeProfile")}>
      <ProfileForm userId={userId} fullName={suggestedName ?? ""} />
      <div className="self-start">
        <SignOutButton />
      </div>
    </AuthPanel>
  );
}
