import type { ReactNode } from "react";

export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-mizan-selected px-2.5 py-1 text-xs font-bold text-mizan-deep">
      <span aria-hidden className="size-1.5 rounded-full bg-mizan-accent" />
      {children}
    </span>
  );
}
