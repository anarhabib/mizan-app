import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidateSaleOverviews, saleOverviewQuery } from "./queries";

it("invalidates every cached sales period for the affected store only", async () => {
  const client = new QueryClient();
  const scope = { organizationId: "org", storeId: "store" };
  const allTime = saleOverviewQuery(scope, {}).queryKey;
  const singleDay = saleOverviewQuery(scope, {
    dateFrom: "2026-11-23",
    dateTo: "2026-11-23",
  }).queryKey;
  const otherStore = saleOverviewQuery(
    { ...scope, storeId: "other" },
    {},
  ).queryKey;
  for (const key of [allTime, singleDay, otherStore])
    client.setQueryData(key, {
      completedSales: 0,
      productsSold: 0,
      salesAmount: [],
      amountReceived: [],
      outstandingDebt: [],
    });

  await invalidateSaleOverviews(client, scope);

  expect(client.getQueryState(allTime)?.isInvalidated).toBe(true);
  expect(client.getQueryState(singleDay)?.isInvalidated).toBe(true);
  expect(client.getQueryState(otherStore)?.isInvalidated).toBe(false);
});
