import { formatPurity } from "@/shared/lib/format";
export function PurityText({ value }: { value: number }) {
  return <span className="tabular-nums">{formatPurity(value)}</span>;
}
