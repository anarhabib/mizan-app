import { AlertDialog } from "radix-ui";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function ConfirmAction({
  kind,
  target,
  busy,
  onConfirm,
}: {
  kind: "deactivate" | "revoke" | "resend" | "remove";
  target: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("team");
  const action = t(`actions.${kind}`);
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 lg:min-h-8"
          disabled={busy}
        >
          {action}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="fixed inset-x-0 bottom-0 z-50 grid max-h-dvh gap-4 overflow-auto rounded-t-xl border bg-popover p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-popover-foreground lg:inset-auto lg:top-1/2 lg:left-1/2 lg:w-104 lg:-translate-1/2 lg:rounded-xl">
          <AlertDialog.Title className="font-heading text-base font-semibold">
            {action}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground wrap-anywhere">
            {t(`confirm.${kind}`, { target })}
          </AlertDialog.Description>
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" className="min-h-11 lg:min-h-8">
                {t("cancel")}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={kind === "resend" ? "default" : "destructive"}
                className="min-h-11 lg:min-h-8"
                disabled={busy}
                onClick={onConfirm}
              >
                {action}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
