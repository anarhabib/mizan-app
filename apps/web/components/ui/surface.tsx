import type { ComponentProps } from "react";

export function Surface({
  className = "",
  tone = "light",
  ...props
}: ComponentProps<"div"> & { tone?: "light" | "dark" }) {
  return (
    <div
      {...props}
      className={`mizan-glass-${tone} box-border rounded-[19px] min-[761px]:rounded-[26px] ${className}`}
    />
  );
}
