import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mizan-page-heading">
      <div className="min-w-0">
        <h1 className="wrap-anywhere">{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
