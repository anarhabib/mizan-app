import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "cn";

export function PendingButton({
  pending,
  disabled,
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "asChild"> & { pending: boolean }) {
  return (
    <Button
      {...props}
      disabled={disabled || pending}
      className={cn(pending && "disabled:opacity-100", className)}
      aria-busy={pending || undefined}
    >
      {pending && (
        <Spinner
          aria-hidden="true"
          className="size-4 shrink-0 motion-reduce:animate-none"
        />
      )}
      {children}
    </Button>
  );
}
