import type { MoneyInput } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/shared/lib/format";
export function MoneyText({
  value,
  exact,
}: {
  value: MoneyInput;
  exact?: boolean;
}) {
  const { i18n } = useTranslation();
  return (
    <span className="tabular-nums">
      {formatMoney(value, i18n.resolvedLanguage, exact)}
    </span>
  );
}
