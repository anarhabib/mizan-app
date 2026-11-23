import type { DashboardComparison, MoneyInput } from "@mizan/contracts";
import { SaleDecimal } from "../sales/settlement.js";

export function compareDay(
  current: string | number | null,
  previous: string | number | null,
): DashboardComparison | null {
  if (current === null || previous === null) return null;
  const baseline = new SaleDecimal(previous);
  const change = new SaleDecimal(current).minus(baseline);
  return {
    absolute: change.toFixed(),
    percent: baseline.isZero()
      ? null
      : change.div(baseline.abs()).times(100).toFixed(2),
    direction: change.isZero() ? "flat" : change.isNegative() ? "down" : "up",
  };
}

export function compareMoney(
  current: MoneyInput[] | null,
  previous: MoneyInput[] | null,
) {
  if (current === null || previous === null) return [];
  const currencies = new Set(
    [...current, ...previous].map(({ currency }) => currency),
  );
  return [...currencies].flatMap((currency) => {
    const today = current.find((value) => value.currency === currency);
    const yesterday = previous.find((value) => value.currency === currency);
    const comparison = compareDay(
      today?.amount ?? "0",
      yesterday?.amount ?? null,
    );
    return comparison ? [{ ...comparison, currency }] : [];
  });
}
