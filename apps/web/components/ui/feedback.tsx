import { CircleAlert, Info } from "lucide-react";
import type { ReactNode } from "react";

export function Feedback({
  error = false,
  children,
}: {
  error?: boolean;
  children: ReactNode;
}) {
  const Icon = error ? CircleAlert : Info;
  return (
    <p
      role={error ? "alert" : "status"}
      className="m-0 flex items-start gap-2 rounded-xl bg-mizan-selected p-3 text-sm font-semibold text-mizan-ink"
    >
      <Icon size={18} className="shrink-0" aria-hidden />
      {children}
    </p>
  );
}
