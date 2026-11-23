import { Prisma } from "@mizan/database";
import { expect, test } from "vitest";
import { summarizeMarketSeries } from "../src/modules/dashboard/market-history.js";

const point = (minute: number, value: string | null) => ({
  at: new Date(Date.UTC(2026, 10, 23, 12, minute)),
  value: value === null ? null : new Prisma.Decimal(value),
});

test("computes exact movement from the first and last stored observations, and keeps extrema before sampling", () => {
  expect(
    summarizeMarketSeries(
      [point(0, "2000.2"), point(1, "2100.4"), point(60, "1980.198")],
      "24h",
    ),
  ).toMatchObject({
    high: "2100.4",
    low: "1980.198",
    movement: { absolute: "-20.002", percent: "-1.00", direction: "down" },
  });
});

test("leaves movement unavailable with zero, one or missing recent observations", () => {
  expect(summarizeMarketSeries([], "90d")).toEqual({
    points: [],
    high: null,
    low: null,
    movement: null,
  });
  expect(summarizeMarketSeries([point(0, "2000")], "7d").movement).toBeNull();
  const gap = summarizeMarketSeries(
    [point(0, "2000"), point(1, "2050"), point(2, null)],
    "7d",
  );
  expect(gap.points.at(-1)?.value).toBeNull();
  expect(gap.movement).toBeNull();
});
