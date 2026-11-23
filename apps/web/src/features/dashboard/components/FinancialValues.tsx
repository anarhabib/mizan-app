import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { DashboardComparison } from "@mizan/contracts";
import { useTranslation } from "react-i18next";
import { formatDecimal } from "@/shared/lib/format";

export type FinancialMeaning =
  "inflow" | "outflow" | "receivable" | "profit" | "neutral";

export function financialTone(meaning: FinancialMeaning, amount: string) {
  const zero = /^[-+]?0(?:\.0+)?$/.test(amount);
  if (zero) return { sign: "", className: "" };
  if (meaning === "inflow" && !amount.startsWith("-"))
    return { sign: "+", className: "text-success-foreground" };
  if (meaning === "receivable")
    return { sign: "", className: "text-warning-foreground" };
  if (meaning === "outflow" || (meaning === "profit" && amount.startsWith("-")))
    return { sign: "", className: "text-danger-foreground" };
  return { sign: "", className: "" };
}

const directions = {
  up: {
    icon: ArrowUpRight,
    label: "directionUp",
    className: "text-success-foreground",
  },
  down: {
    icon: ArrowDownRight,
    label: "directionDown",
    className: "text-danger-foreground",
  },
  flat: {
    icon: Minus,
    label: "directionFlat",
    className: "text-muted-foreground",
  },
} as const;

export function Trend({
  movement,
  format,
  daily = false,
}: {
  movement: DashboardComparison | null;
  format: (amount: string) => string;
  daily?: boolean;
}) {
  const { t, i18n } = useTranslation("dashboard");
  if (movement === null)
    return <span className="text-muted-foreground">{t("noComparison")}</span>;
  const { icon: Icon, label, className } = directions[movement.direction];
  const sign = movement.direction === "up" ? "+" : "";
  const percent = movement.percent;
  return (
    <span
      title={daily ? t("vsPrevious") : undefined}
      className={`inline-flex flex-wrap items-center justify-end gap-x-1 text-xs tabular-nums ${className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">
        {daily ? `${t("vsPrevious")}. ` : ""}
        {t(label)}.{" "}
      </span>
      <span>
        {sign}
        {format(movement.absolute)}
      </span>
      {percent === null ? (
        <span className="text-muted-foreground" title={t("noPercentage")}>
          <span aria-hidden="true">(—)</span>
          <span className="sr-only">{t("noPercentage")}</span>
        </span>
      ) : (
        <span>
          ({sign}
          {formatDecimal(percent, i18n.resolvedLanguage ?? "az")}%)
        </span>
      )}
    </span>
  );
}
