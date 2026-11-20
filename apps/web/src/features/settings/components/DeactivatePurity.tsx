import { useState } from "react";
import { AlertDialog } from "radix-ui";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function DeactivatePurity({
  value,
  busy,
  error,
  save,
}: {
  value: number;
  busy: boolean;
  error?: string;
  save: () => Promise<boolean>;
}) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <AlertDialog.Trigger asChild>
        <Button
          variant="outline"
          disabled={busy}
          className="min-h-10 lg:min-h-8"
          aria-label={t("deactivatePurity", { value })}
        >
          {t("deactivate")}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content
          className="fixed inset-x-0 bottom-0 z-50 grid max-h-dvh gap-3 overflow-auto rounded-t-xl border bg-popover p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-popover-foreground sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-104 sm:-translate-1/2 sm:rounded-xl"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <AlertDialog.Title className="font-heading text-base font-semibold">
            {t("deactivatePurity", { value })}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted-foreground">
            {t("deactivateDescription")}
          </AlertDialog.Description>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button
                variant="outline"
                disabled={busy}
                className="min-h-10 lg:min-h-8"
              >
                {t("cancel")}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant="destructive"
              disabled={busy}
              className="min-h-10 lg:min-h-8"
              onClick={async () => {
                if (await save()) setOpen(false);
              }}
            >
              {busy ? t("saving") : t("deactivate")}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
