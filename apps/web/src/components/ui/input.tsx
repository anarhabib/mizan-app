import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-control-border bg-control px-2.5 py-1 text-base text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-control file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-control-hover-border focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:hover:border-foreground/40 dark:shadow-none md:text-sm",
        type === "date" &&
          "max-w-full appearance-none [&::-webkit-date-and-time-value]:min-w-0",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
