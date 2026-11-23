import type { ReactNode } from "react";
import { DocumentTitle } from "./DocumentTitle";
export function PageHeader({
  title,
  actions,
  description,
}: {
  title: string;
  actions?: ReactNode;
  description?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <DocumentTitle title={title} />
      <div className="min-w-0">
        <h1 className="font-heading text-xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 wrap-anywhere text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions}
    </header>
  );
}
