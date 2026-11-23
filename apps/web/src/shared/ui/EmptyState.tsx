import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
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
    <Empty className="min-h-48 gap-3 rounded-lg border border-dashed bg-card">
      <EmptyHeader>
        <h2 className="font-medium">{title}</h2>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
