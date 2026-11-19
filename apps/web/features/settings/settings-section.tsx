import type { ReactNode } from "react";
import { Surface } from "../../components/ui/surface";

export function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Surface className="grid min-w-0 gap-4 p-4 sm:p-5">
      <h2 className="m-0 flex items-center gap-2 text-lg leading-tight font-extrabold tracking-tight">
        {icon && <span className="shrink-0">{icon}</span>}
        {title}
      </h2>
      {children}
    </Surface>
  );
}
