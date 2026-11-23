import { PendingButton } from "@/shared/ui/PendingButton";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSession } from "@/features/auth";
import {
  notifyDisplayModeChange,
  restrictDisplay,
  useWorkspace,
} from "@/features/workspace";
import { auth } from "@/shared/lib/auth";

export function DisplayModeControl({
  concealWorkspace,
  open,
  onOpenChange,
  restoreFocus,
}: {
  concealWorkspace: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
}) {
  const { t } = useTranslation(["shell", "auth"]);
  const { email, userId } = useSession();
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, reset, formState } = useForm<{
    password: string;
  }>();
  const { errors, isSubmitting } = formState;
  const owner = workspace.canManageAsOwner;
  const target = t(owner ? "displayMode.salesperson" : "displayMode.owner");

  async function change({ password }: { password: string }) {
    if (!userId) return;
    try {
      if (owner) {
        concealWorkspace();
        await restrictDisplay(userId, workspace);
      } else {
        if (!auth || !email) {
          setError("root", { message: t("displayMode.unavailable") });
          return;
        }
        const { data, error } = await auth.signInWithPassword({
          email,
          password,
        });
        if (error?.code === "invalid_credentials") {
          setError("root", { message: t("displayMode.invalidPassword") });
          return;
        }
        if (error || data.session?.user.id !== userId) {
          setError("root", { message: t("displayMode.failed") });
          return;
        }
        notifyDisplayModeChange(userId);
      }
      queryClient.clear();
      window.location.reload();
    } catch {
      setError("root", { message: t("displayMode.failed") });
    }
  }

  if (!workspace.canSwitchDisplayMode) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto max-h-dvh max-w-md overflow-y-auto rounded-t-lg pb-[env(safe-area-inset-bottom)]"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <SheetHeader>
          <SheetTitle>{t("displayMode.switchTo", { mode: target })}</SheetTitle>
          <SheetDescription>
            {t(owner ? "displayMode.restrict" : "displayMode.authenticate")}
          </SheetDescription>
        </SheetHeader>
        <form className="grid gap-4 px-4 pb-6" onSubmit={handleSubmit(change)}>
          {!owner && (
            <div className="grid gap-2">
              <Label htmlFor="display-mode-password">
                {t("password", { ns: "auth" })}
              </Label>
              <Input
                id="display-mode-password"
                className="min-h-11 lg:min-h-9"
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(errors.root)}
                aria-describedby={
                  errors.root ? "display-mode-error" : undefined
                }
                {...register("password", { required: true })}
              />
            </div>
          )}
          {errors.root?.message && (
            <p
              id="display-mode-error"
              role="alert"
              className="text-destructive"
            >
              {errors.root.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 lg:min-h-9"
              disabled={isSubmitting}
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              {t("displayMode.cancel")}
            </Button>
            <PendingButton
              pending={isSubmitting}
              className="min-h-11 lg:min-h-9"
              disabled={isSubmitting}
            >
              {t(
                isSubmitting ? "displayMode.switching" : "displayMode.confirm",
              )}
            </PendingButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
