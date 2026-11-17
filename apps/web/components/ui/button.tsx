import type { ComponentProps } from "react";

export const focusClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mizan-focus";

export const actionClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[13px] border border-transparent px-3.5 py-2 text-sm font-bold no-underline " +
  focusClass;

const variants = {
  primary:
    "bg-mizan-primary text-mizan-primary-text hover:bg-mizan-primary-hover active:bg-mizan-primary-pressed",
  secondary:
    "border-mizan-edge bg-mizan-surface text-mizan-ink hover:bg-mizan-selected",
  inverse:
    "bg-mizan-inverse text-mizan-deep hover:bg-mizan-inverse-hover active:bg-mizan-inverse-pressed",
};

export function Button({
  variant = "primary",
  type = "button",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return (
    <button
      {...props}
      type={type}
      className={`${actionClass} ${variants[variant]} cursor-pointer font-[inherit] disabled:cursor-default disabled:opacity-65 motion-safe:transition-transform motion-safe:enabled:hover:-translate-y-0.5 motion-safe:enabled:active:translate-y-px ${className}`}
    />
  );
}
