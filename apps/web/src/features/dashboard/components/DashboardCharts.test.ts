import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { formatMarketTime, weeklyChartData } from "./DashboardCharts";
import { financialTone } from "./FinancialValues";

test("uses the same daily series for currency-specific amounts and transaction counts", () => {
  const days = [
    {
      day: "2026-11-22",
      sales: [{ currency: "USD", amount: "7.50" }],
      payments: [],
      count: 1,
    },
    {
      day: "2026-11-23",
      sales: [{ currency: "AZN", amount: "1250.24" }],
      payments: [{ currency: "AZN", amount: "700" }],
      count: 3,
    },
  ];
  expect(weeklyChartData(days, "sales", "AZN").map(({ raw }) => raw)).toEqual([
    "0",
    "1250.24",
  ]);
  expect(weeklyChartData(days, "count").map(({ raw }) => raw)).toEqual([
    "1",
    "3",
  ]);
  expect(
    weeklyChartData(days, "payments", "AZN").map(({ raw }) => raw),
  ).toEqual(["0", "700"]);
});

test("colors financial values according to their meaning", () => {
  expect(financialTone("inflow", "1250")).toEqual({
    sign: "+",
    className: "text-success-foreground",
  });
  expect(financialTone("outflow", "-350").className).toBe(
    "text-danger-foreground",
  );
  expect(financialTone("receivable", "600").className).toBe(
    "text-warning-foreground",
  );
  expect(financialTone("profit", "-10").className).toBe(
    "text-danger-foreground",
  );
  expect(financialTone("neutral", "-350").className).toBe("");
  expect(financialTone("inflow", "0.00").className).toBe("");
});

test("the gold tooltip formats the numeric timestamp as Baku time", () => {
  const at = Date.parse("2026-11-22T20:15:00Z");
  const tooltip = createElement(ChartTooltipContent, {
    active: true,
    label: at,
    labelFormatter: (label) => {
      expect(label).toBe(at);
      return formatMarketTime(at, "en");
    },
    payload: [
      {
        graphicalItemId: "gold-price",
        dataKey: "y",
        name: "y",
        value: 4126.44,
      },
    ],
  });
  const html = renderToStaticMarkup(
    createElement(ChartContainer, {
      config: { y: { label: "USD / troy oz" } },
      children: tooltip,
    }),
  );
  expect(html).toContain("11/23, 00:15");
});

test("an unavailable or invalid date can be displayed without throwing", () => {
  expect(formatMarketTime("unavailable", "az")).toBe("—");
  expect(formatMarketTime(Number.NaN, "en")).toBe("—");
});
