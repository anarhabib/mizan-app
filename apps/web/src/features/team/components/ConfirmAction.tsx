import { useState } from "react";
import { PendingButton } from "@/shared/ui/PendingButton";
import { Ban, CircleMinus, RotateCw, Trash2 } from "lucide-react";
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

export function ConfirmAction({
  kind,
  target,
  busy,
  onConfirm,
}: {
  kind: "deactivate" | "revoke" | "resend" | "remove";
  target: string;
  busy: boolean;
  onConfirm: (onError: (message: string) => void) => Promise<boolean>;
}) {
  const { t } = useTranslation("team");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const action = t(`actions.${kind}`);
  const ActionIcon =
    kind === "resend"
      ? RotateCw
      : kind === "revoke"
        ? Ban
        : kind === "remove"
          ? Trash2
          : CircleMinus;
  const variant = kind === "resend" ? "default" : "destructive";
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setOpen(next);
          setError(undefined);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          className="min-h-11 lg:min-h-8"
          disabled={busy}
        >
          <ActionIcon aria-hidden="true" />
          {action}
        </Button>
      </AlertDialogTrigger>

      <ConfirmationContent
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <AlertDialogTitle className="font-heading text-base font-semibold">
          {action}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground wrap-anywhere">
          {t(`confirm.${kind}`, { target })}
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
              className="min-h-11 lg:min-h-8"
            >
              {t("cancel")}
            </Button>
          </AlertDialogCancel>
          <PendingButton
            pending={busy}
            variant={variant}
            className="min-h-11 lg:min-h-8"
            onClick={async () => {
              setError(undefined);
              if (await onConfirm(setError)) setOpen(false);
            }}
          >
            {!busy && <ActionIcon aria-hidden="true" />}
            {action}
          </PendingButton>
        </div>
      </ConfirmationContent>
    </AlertDialog>
  );
}
