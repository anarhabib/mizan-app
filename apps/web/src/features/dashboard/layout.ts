import type { BusinessWidgetId } from "./preferences";

type Width = "compact" | "standard" | "wide";

const widths: Partial<Record<BusinessWidgetId, Width>> = {
  grossProfit: "compact",
  intakeCost: "compact",
  inventoryCost: "compact",
  exchange: "compact",
  activity: "compact",
  recentSales: "compact",
  recentIntake: "compact",
  recentTradeIns: "compact",
  recentRepayments: "compact",
  gold: "wide",
  salesTrend: "wide",
  paymentTrend: "wide",
  storeRates: "wide",
};

export function desktopColumns(widgets: readonly BusinessWidgetId[]) {
  return widgets.length === 2 &&
    widgets.every((widget) => (widths[widget] ?? "standard") === "standard")
    ? 2
    : 3;
}

export function widgetSpans(
  widgets: readonly BusinessWidgetId[],
  columns: 2 | 3,
  pairCharts = false,
) {
  const preferred = widgets.map((widget) => {
    if (widget === "storeRates") return columns;
    const width = widths[widget] ?? "standard";
    return width === "wide" || (width === "standard" && widgets.length === 1)
      ? 2
      : 1;
  });
  if (columns !== 2 || !pairCharts) return preferred;

  let openColumn = false;
  return preferred.map((span, index) => {
    const chart =
      span === 2 &&
      widgets[index] !== "storeRates" &&
      widths[widgets[index]] === "wide";
    // Pair a chart with an unpaired neighbor when both columns are roomy.
    const pair =
      chart &&
      (openColumn ||
        (preferred[index + 1] === 1 && preferred[index + 2] !== 1));
    const fitted = pair ? 1 : span;
    openColumn = fitted === 1 && !openColumn;
    return fitted;
  });
}

export function packWidgets(
  widgets: { span: number; height: number }[],
  columns: 2 | 3,
  gap: number,
) {
  const bottoms = Array<number>(columns).fill(0);
  let previousTop = 0;
  let previousColumn = -1;
  return widgets.map(({ span, height }) => {
    let top = Infinity;
    let column = 0;
    for (let start = 0; start <= columns - span; start++) {
      const earliest = Math.max(...bottoms.slice(start, start + span));
      // Never place a later widget above or to the left of the preceding one
      // at the same height. Keyboard and visual orders stay aligned.
      const candidate = Math.max(
        earliest,
        previousTop + (start < previousColumn ? 1 : 0),
      );
      if (candidate < top) {
        top = candidate;
        column = start;
      }
    }
    bottoms.fill(top + height + gap, column, column + span);
    previousTop = top;
    previousColumn = column;
    return { column: column + 1, top };
  });
}
