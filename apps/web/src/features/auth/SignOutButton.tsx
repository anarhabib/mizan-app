import { LogOut } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PendingButton } from "@/shared/ui/PendingButton";
import { auth } from "@/shared/lib/auth";

export function useSignOut() {
  const { t } = useTranslation("auth");
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (!auth || pending) return;
    setPending(true);
    try {
      const { error } = await auth.signOut({ scope: "local" });
      if (error) toast.error(t("genericError"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setPending(false);
    }
  }
  return { signOut, pending };
}

export function SignOutButton() {
  const { t } = useTranslation("auth");
  const { signOut, pending } = useSignOut();

  return (
    <PendingButton
      type="button"
      variant="outline"
      pending={pending}
      aria-label={t("signOut")}
      onClick={() => void signOut()}
      className="min-h-11 min-w-11 lg:min-h-9"
    >
      {!pending && <LogOut aria-hidden="true" />}
      {t("signOut")}
    </PendingButton>
  );
}
