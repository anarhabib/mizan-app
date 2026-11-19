import type { ReactNode } from "react";

export function StatusBadge({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${muted ? "bg-slate-100 text-slate-600" : "bg-mizan-selected text-mizan-deep"}`}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${muted ? "bg-slate-500" : "bg-mizan-accent"}`}
      />
      {children}
    </span>
  );
}
