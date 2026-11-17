import type { ComponentProps, ReactNode } from "react";
import { focusClass } from "./button";

export function Field({
  id,
  label,
  error,
  action,
  "aria-describedby": describedBy,
  ...props
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
  action?: ReactNode;
}) {
  const description = [describedBy, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div className="flex min-w-0 items-center gap-2">
        <input
          {...props}
          id={id}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={description || undefined}
          className={`box-border min-h-11 w-full min-w-0 rounded-xl border border-mizan-edge bg-mizan-field px-3 text-base text-mizan-ink ${focusClass}`}
        />
        {action}
      </div>
      {error && (
        <span
          id={`${id}-error`}
          className="text-sm font-semibold text-mizan-ink"
        >
          {error}
        </span>
      )}
    </div>
  );
}
