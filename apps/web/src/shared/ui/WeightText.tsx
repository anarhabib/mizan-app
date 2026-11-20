import { useTranslation } from "react-i18next";
import { formatWeight } from "@/shared/lib/format";
export function WeightText({ value }: { value: string }) {
  const { i18n } = useTranslation();
  return (
    <span className="tabular-nums">
      {formatWeight(value, i18n.resolvedLanguage)}
    </span>
  );
}
