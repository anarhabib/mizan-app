import { PendingButton } from "@/shared/ui/PendingButton";
import { useState } from "react";
import { CircleMinus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConfirmationContent } from "@/shared/ui/ConfirmationContent";
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
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          disabled={busy}
          className="min-h-10 lg:min-h-8"
          aria-label={t("deactivatePurity", { value })}
        >
          <CircleMinus aria-hidden="true" />
          {t("deactivate")}
        </Button>
      </AlertDialogTrigger>

      <ConfirmationContent
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <AlertDialogTitle className="font-heading text-base font-semibold">
          {t("deactivatePurity", { value })}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-sm text-muted-foreground">
          {t("deactivateDescription")}
        </AlertDialogDescription>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button
              variant="secondary"
              disabled={busy}
              className="min-h-10 lg:min-h-8"
            >
              {t("cancel")}
            </Button>
          </AlertDialogCancel>
          <PendingButton
            pending={busy}
            variant="destructive"
            disabled={busy}
            className="min-h-10 lg:min-h-8"
            onClick={async () => {
              if (await save()) setOpen(false);
            }}
          >
            {busy ? t("saving") : t("deactivate")}
          </PendingButton>
        </div>
      </ConfirmationContent>
    </AlertDialog>
  );
}
