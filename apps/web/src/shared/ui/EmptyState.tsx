import type { ReactNode } from "react";
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-6 text-center">
      <h2 className="font-medium">{title}</h2>
      {description && (
        <p className="max-w-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </section>
  );
}
