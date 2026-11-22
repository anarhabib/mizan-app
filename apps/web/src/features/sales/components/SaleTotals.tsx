import type { MoneyInput } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { MoneyText } from "@/shared/ui/MoneyText";

export function SaleTotals({
  total,
  tradeIn,
  paid,
  outstanding,
}: {
  total: MoneyInput;
  tradeIn: MoneyInput;
  paid?: MoneyInput;
  outstanding?: MoneyInput;
}) {
  const { t } = useTranslation("sales");
  return (
    <dl
      className="grid min-w-0 grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3"
      aria-live="polite"
    >
      {(
        [
          ["saleTotal", total],
          ["tradeInTotal", tradeIn],
          ["paidAmount", paid],
          ["outstandingDebt", outstanding],
        ] as const
      ).map(([field, value]) => (
        <div key={field} className="min-w-0">
          <dt className="text-xs text-muted-foreground">
            {t(`fields.${field}`)}
          </dt>
          <dd className="mt-1 font-medium wrap-anywhere">
            {value ? <MoneyText value={value} /> : "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
