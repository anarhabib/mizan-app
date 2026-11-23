import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function PageContainer({
  width = "standard",
  className,
  ...props
}: ComponentProps<"div"> & { width?: "wide" | "standard" | "narrow" }) {
  return (
    <div
      className={cn("page-container", className)}
      data-width={width}
      {...props}
    />
  );
}
