import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { formatMarketTime } from "./DashboardCharts";

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
