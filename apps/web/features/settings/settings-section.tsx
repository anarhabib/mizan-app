import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

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
    <details className="mizan-glass-light group rounded-[19px]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-[19px] px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-mizan-focus [&::-webkit-details-marker]:hidden">
        {icon}
        {title}
        <ChevronDown
          className="ml-auto shrink-0 group-open:rotate-180"
          size={18}
          aria-hidden="true"
        />
      </summary>
      <div className="grid min-w-0 gap-4 px-4 pt-2 pb-4">{children}</div>
    </details>
  );
}
