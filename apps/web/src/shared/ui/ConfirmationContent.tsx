import type { ComponentProps } from "react";
import { cn } from "cn";
import { AlertDialogContent } from "@/components/ui/alert-dialog";

export function ConfirmationContent({
  className,
  ...props
}: ComponentProps<typeof AlertDialogContent>) {
  return (
    <AlertDialogContent
      className={cn(
        "inset-x-0 top-auto bottom-0 max-h-dvh translate-none overflow-auto rounded-t-xl rounded-b-none border bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-card-foreground data-[size=default]:max-w-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(26rem,calc(100vw-2rem))] sm:-translate-1/2 sm:rounded-xl sm:pb-6 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
