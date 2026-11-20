import { LogOut } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { auth } from "@/shared/lib/auth";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("auth");
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (!auth) return;
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

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      aria-label={t("signOut")}
      title={compact ? t("signOut") : undefined}
      onClick={() => void signOut()}
      className="min-h-11 min-w-11 lg:min-h-9"
    >
      <LogOut aria-hidden="true" />
      {!compact && t("signOut")}
    </Button>
  );
}
