import type { ReactNode } from "react";
export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-heading text-xl font-semibold">{title}</h1>
      {actions}
    </header>
  );
}
