import { randomUUID } from "node:crypto";
import { createDatabase } from "@mizan/database";
import { afterAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";
import {
  dashboardCharts,
  dashboardOwnerSummary,
  dashboardSummary,
  dashboardWindow,
} from "../src/modules/dashboard/dashboard.service.js";
import { createExchangeRateService } from "../src/modules/exchange-rates/exchange-rates.service.js";
import {
  compareDay,
  compareMoney,
} from "../src/modules/dashboard/comparison.js";

test("compares decimals, negative profit and zero or missing baselines", () => {
  expect(compareDay("115.40", "112.96")).toEqual({
    absolute: "2.44",
    percent: "2.16",
    direction: "up",
  });
  expect(compareDay("-5", "-10")).toEqual({
    absolute: "5",
    percent: "50.00",
    direction: "up",
  });
  expect(compareDay("-10", "-5")).toEqual({
    absolute: "-5",
    percent: "-100.00",
    direction: "down",
  });
  expect(compareDay(0, 0)).toEqual({
    absolute: "0",
    percent: null,
    direction: "flat",
  });
  expect(compareDay(2, 0)).toEqual({
    absolute: "2",
    percent: null,
    direction: "up",
  });
  expect(compareDay(2, null)).toBeNull();
  expect(compareDay(null, 2)).toBeNull();
  expect(compareMoney([], null)).toEqual([]);
});

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local dashboard database");
const db = url ? createDatabase(url) : undefined;
afterAll(async () => db?.$disconnect());

test("uses Asia/Baku midnight and compares the same portion of yesterday", () => {
  expect(dashboardWindow(new Date("2026-11-22T20:15:00.000Z"))).toEqual({
    day: "2026-11-23",
    start: new Date("2026-11-22T20:00:00.000Z"),
    previousStart: new Date("2026-11-21T20:00:00.000Z"),
    previousThrough: new Date("2026-11-21T20:15:00.000Z"),
    weekStart: new Date("2026-11-16T20:00:00.000Z"),
  });
});

test.skipIf(!db)(
  "isolates stores and separates sales, net payments, repayments, trade-ins and stock",
  async () => {
    if (!db) throw new Error("Test database missing");
    const owner = randomUUID(),
      staff = randomUUID(),
      sessionId = randomUUID();
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) =>
          token === "owner"
            ? { userId: owner, sessionId }
            : token === "staff"
              ? { userId: staff }
              : null,
      },
      onboardingDb: db,
      settingsDb: db,
      products: { db },
      salesDb: db,
      goldMarketEnabled: false,
    });
    const send = (
      method: "GET" | "POST",
      path: string,
      payload?: object,
      role = "owner",
      key = randomUUID(),
      confirmation?: string,
    ) =>
      app.inject({
        method,
        url: `/api/v1${path}`,
        payload,
        headers: {
          authorization: `Bearer ${role}`,
          "idempotency-key": key,
          ...(confirmation && { "sale-confirmation": confirmation }),
        },
      });
    try {
      const registration = await send("POST", "/onboarding", {
        fullName: "Dashboard Test Owner",
        organizationName: "Dashboard",
        storeName: "Main",
        defaultCurrency: "AZN",
      });
      expect(registration.statusCode).toBe(200);
      const { organizationId, storeId } = registration.json();
      const scope = { organizationId, storeId };
      const root = `/organizations/${organizationId}/stores/${storeId}`;
      const query = new URLSearchParams(scope);
      const branch = await db.store.create({
        data: { organizationId, name: "Second store" },
      });
      await db.user.create({ data: { id: staff } });
      await db.organizationMembership.create({
        data: { organizationId, userId: staff, role: "SALESPERSON" },
      });
      await db.storeAssignment.createMany({
        data: [
          { ...scope, userId: staff },
          { organizationId, storeId: branch.id, userId: owner },
        ],
      });
      const now = new Date("2026-11-23T08:00:00.000Z");
      const midnight = dashboardWindow(now).start;
      const previous = dashboardWindow(now).previousStart;
      const customer = (
        await send("POST", `${root}/customers`, {
          name: "Dashboard debtor",
          phone: "0501234567",
        })
      ).json();
      await send("POST", `${root}/customers`, {
        name: "No debt",
        phone: "0501234568",
      });
      async function product(name: string, store = storeId, received?: Date) {
        const row = await db!.product.create({
          data: {
            organizationId,
            storeId: store,
            code: randomUUID(),
            name,
            category: "Rings",
            purity: 585,
            weight: "3",
            netGoldWeight: "2",
            acquisitionCost: "30",
            acquisitionCurrency: "AZN",
          },
        });
        if (received)
          await db!.inventoryMovement.create({
            data: {
              organizationId,
              storeId: store,
              actorId: owner,
              productId: row.id,
              kind: "PRODUCT_ADDED",
              createdAt: received,
            },
          });
        return row;
      }
      const first = await product("Today", storeId, midnight);
      const second = await product("Yesterday", storeId, previous);
      const aged = await product(
        "Aged",
        storeId,
        new Date("2025-01-01T00:00:00Z"),
      );
      await product("No movement");
      await product("Second store only", branch.id, midnight);
      const sale = {
        productId: first.id,
        saleAmount: "100",
        customerId: customer.id,
        tradeIns: [
          { purity: 585, weight: "2.5", rateId: null, overrideAmount: "15" },
        ],
        payments: [{ method: "CARD", currency: "AZN", amount: "20" }],
      };
      const key = randomUUID();
      const challenge = await send(
        "POST",
        `/sales?${query}`,
        sale,
        "owner",
        key,
      );
      expect(challenge.statusCode).toBe(409);
      const firstSale = await send(
        "POST",
        `/sales?${query}`,
        sale,
        "owner",
        key,
        challenge.json().confirmation.token,
      );
      expect(firstSale.statusCode, firstSale.body).toBe(201);
      const id = firstSale.json().id;
      const repayment = await send("POST", `/sales/${id}/payments?${query}`, {
        method: "TRANSFER",
        currency: "USD",
        amount: "10",
        exchangeRate: "1.70",
      });
      expect(repayment.statusCode, repayment.body).toBe(201);
      const salesOverview = await send("GET", `/sales/overview?${query}`);
      expect(salesOverview.statusCode, salesOverview.body).toBe(200);
      expect(salesOverview.json()).toEqual({
        completedSales: 1,
        productsSold: 1,
        salesAmount: [{ amount: "100", currency: "AZN" }],
        amountReceived: [{ amount: "37", currency: "AZN" }],
        outstandingDebt: [{ amount: "48", currency: "AZN" }],
      });
      const priorSale = await send("POST", `/sales?${query}`, {
        productId: second.id,
        saleAmount: "50",
        payment: { currency: "AZN", amount: "60", exchangeRate: "1" },
      });
      expect(priorSale.statusCode, priorSale.body).toBe(201);
      const priorId = priorSale.json().id;
      await db.sale.updateMany({
        where: { ...scope, id },
        data: { createdAt: midnight },
      });
      await db.sale.updateMany({
        where: { ...scope, id: priorId },
        data: { createdAt: previous },
      });
      await db.salePayment.updateMany({
        where: { ...scope, saleId: id, position: null },
        data: { createdAt: new Date(+midnight + 86_400_000) },
      });
      const filteredSales = (path: string, filters: string) =>
        send("GET", `/sales${path}?${query}&${filters}`);
      const today = "dateFrom=2026-11-23&dateTo=2026-11-23";
      const yesterday = "dateFrom=2026-11-22&dateTo=2026-11-22";
      expect((await filteredSales("/overview", today)).json()).toEqual(
        salesOverview.json(),
      );
      expect((await filteredSales("", today)).json().items).toMatchObject([
        { id },
      ]);
      expect((await filteredSales("", yesterday)).json().items).toMatchObject([
        { id: priorId },
      ]);
      expect(
        (await filteredSales("/overview", yesterday)).json(),
      ).toMatchObject({
        completedSales: 1,
        salesAmount: [{ amount: "50", currency: "AZN" }],
      });
      expect(
        (
          await filteredSales(
            "/overview",
            "dateFrom=2026-11-22&dateTo=2026-11-23&limit=10",
          )
        ).json(),
      ).toMatchObject({ completedSales: 2 });
      expect(
        (await filteredSales("/overview", "dateFrom=2026-11-24")).json(),
      ).toMatchObject({ completedSales: 0, salesAmount: [] });
      for (const path of ["", "/overview"]) {
        for (const filters of [
          "dateFrom=2026-11-23&dateTo=2026-11-22",
          "dateTo=2026-02-31",
        ]) {
          expect((await filteredSales(path, filters)).statusCode).toBe(400);
        }
      }
      await db.salePayment.updateMany({
        where: { ...scope, saleId: id },
        data: { createdAt: midnight },
      });
      await db.receivedOldGold.updateMany({
        where: scope,
        data: { receivedAt: midnight },
      });

      const summary = await dashboardSummary(db, scope, false, now);
      expect(summary).toMatchObject({
        day: "2026-11-23",
        sales: {
          count: 1,
          products: 1,
          total: [{ amount: "100", currency: "AZN" }],
          average: [{ amount: "100", currency: "AZN" }],
        },
        previousSales: { count: 1, total: [{ amount: "50", currency: "AZN" }] },
        payments: {
          total: [
            { amount: "20", currency: "AZN" },
            { amount: "10", currency: "USD" },
          ],
          normalized: { amount: "37.00", currency: "AZN" },
          repayments: [{ amount: "10", currency: "USD" }],
          tradeInCredit: [{ amount: "15", currency: "AZN" }],
          methods: [
            { method: "CARD", total: [{ amount: "20", currency: "AZN" }] },
            { method: "TRANSFER", total: [{ amount: "10", currency: "USD" }] },
          ],
        },
        debt: {
          new: [{ amount: "65", currency: "AZN" }],
          outstanding: [{ amount: "48", currency: "AZN" }],
          customers: 1,
          partial: 1,
          unpaid: 0,
        },
        intake: {
          count: 1,
          weight: "3",
          tradeInWeight: "2.5",
          tradeInValue: [{ amount: "15", currency: "AZN" }],
        },
        inventory: { count: 2, weight: "6", marketValue: null },
        comparison: {
          sales: [
            {
              currency: "AZN",
              absolute: "50",
              percent: "100.00",
              direction: "up",
            },
          ],
          saleCount: { absolute: "0", percent: "0.00", direction: "flat" },
          receipts: { absolute: "-13", percent: "-26.00", direction: "down" },
          intake: { absolute: "0", percent: "0.00", direction: "flat" },
        },
      });
      const charts = await dashboardCharts(db, scope, now);
      expect(charts.days).toHaveLength(7);
      expect(charts.days.at(-2)).toMatchObject({
        day: "2026-11-22",
        payments: [{ amount: "50", currency: "AZN" }],
      });
      expect(charts.days.at(-1)).toMatchObject({ day: "2026-11-23", count: 1 });
      expect(charts.settlement).toEqual({
        PAID: 1,
        PARTIALLY_PAID: 1,
        UNPAID: 0,
      });
      expect(await dashboardOwnerSummary(db, scope, now)).toEqual({
        grossProfit: [{ amount: "70", currency: "AZN" }],
        intakeCost: [{ amount: "30", currency: "AZN" }],
        inventoryCost: [{ amount: "60", currency: "AZN" }],
        grossProfitComparison: [
          {
            currency: "AZN",
            absolute: "50",
            percent: "250.00",
            direction: "up",
          },
        ],
      });
      expect(
        (
          await send("GET", `${root}/dashboard/activity`, undefined, "staff")
        ).json(),
      ).toMatchObject({
        debtors: [
          {
            id: customer.id,
            outstanding: { amount: "48.00", currency: "AZN" },
          },
        ],
        items: expect.arrayContaining([
          expect.objectContaining({ kind: "repayment", recordId: id }),
        ]),
      });
      expect(
        (await send("GET", `${root}/dashboard/aged-stock?days=365`)).json(),
      ).toMatchObject({
        count: 1,
        items: [expect.objectContaining({ id: aged.id })],
      });
      expect(
        (
          await send(
            "GET",
            `${root}/customers?outstanding=true`,
            undefined,
            "staff",
          )
        ).json().items,
      ).toEqual([expect.objectContaining({ id: customer.id })]);
      expect(
        (await send("GET", `${root}/dashboard/owner`)).json().inventoryCost,
      ).toEqual([{ amount: "60", currency: "AZN" }]);
      const overviewPath = `/products/overview?${query}`;
      const overview = await send("GET", overviewPath);
      expect(overview.statusCode, overview.body).toBe(200);
      expect(overview.json()).toEqual({
        available: 2,
        sold: 2,
        soldOnCredit: 1,
        availableWeight: "6",
        acquisitionValue: [{ amount: "60", currency: "AZN" }],
      });
      const staffOverview = await send("GET", overviewPath, undefined, "staff");
      expect(staffOverview.statusCode).toBe(200);
      const { acquisitionValue, ...publicOverview } = overview.json();
      expect(acquisitionValue).toHaveLength(1);
      expect(staffOverview.json()).toEqual(publicOverview);
      expect(
        (await send("GET", `${root}/dashboard/owner`, undefined, "staff"))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await send(
            "GET",
            `/organizations/${organizationId}/stores/${branch.id}/dashboard`,
            undefined,
            "staff",
          )
        ).statusCode,
      ).toBe(403);
      expect((await send("POST", `${root}/salesperson-mode`)).statusCode).toBe(
        204,
      );
      expect((await send("GET", `${root}/dashboard/owner`)).statusCode).toBe(
        403,
      );
      const nonOwner = (await send("GET", `${root}/dashboard`)).json();
      expect((await send("GET", overviewPath)).json()).toEqual(publicOverview);
      expect(nonOwner.comparison).toBeDefined();
      expect(nonOwner.inventory.count).toBe(2);
      expect(JSON.stringify(nonOwner)).not.toMatch(
        /grossProfit|acquisitionCost|intakeCost/,
      );
      expect((await send("GET", `${root}/gold-prices/rates`)).statusCode).toBe(
        200,
      );
      async function ids(path: string, filters: string, scopeQuery = query) {
        const result = await send("GET", `${path}?${scopeQuery}&${filters}`);
        expect(result.statusCode, result.body).toBe(200);
        return result.json().items.map((row: { id: string }) => row.id);
      }
      expect(await ids("/sales", "date=2026-11-23")).toEqual([id]);
      expect(await ids("/sales", "paymentStatus=PARTIALLY_PAID")).toEqual([id]);
      expect(await ids("/sales", "paymentStatus=PAID")).toEqual([priorId]);
      expect(await ids("/sales", "paymentStatus=UNPAID")).toEqual([]);
      expect(await ids("/sales", "paymentDate=2026-11-22")).toEqual([priorId]);
      await db.salePayment.updateMany({
        where: { ...scope, saleId: id, position: { not: null } },
        data: { createdAt: previous },
      });
      expect(await ids("/sales", "paymentDate=2026-11-23")).toEqual([id]);
      expect(await ids("/products", "status=SOLD&soldOn=2026-11-23")).toEqual([
        first.id,
      ]);
      expect(
        await ids("/products", "status=SOLD&credit=true&limit=10"),
      ).toEqual([first.id]);
      expect(
        await ids("/products", "credit=true&q=Yesterday&limit=25"),
      ).toEqual([]);
      for (const path of ["/products", "/sales"]) {
        const invalid = await send("GET", `${path}?${query}&limit=11`);
        expect(invalid.statusCode).toBe(400);
        expect(invalid.json().field).toBe("limit");
      }
      expect(await ids("/products", "receivedOn=2026-11-23")).toEqual([
        first.id,
      ]);
      expect(await ids("/products", "status=IN_STOCK&agedDays=365")).toEqual([
        aged.id,
      ]);
      const branchQuery = new URLSearchParams({
        organizationId,
        storeId: branch.id,
      });
      const branchSalesOverview = await send(
        "GET",
        `/sales/overview?${branchQuery}`,
      );
      expect(branchSalesOverview.statusCode).toBe(200);
      expect(branchSalesOverview.json()).toEqual({
        completedSales: 0,
        productsSold: 0,
        salesAmount: [],
        amountReceived: [],
        outstandingDebt: [],
      });
      const branchPath = `/products/overview?${branchQuery}`;
      expect((await send("GET", branchPath)).json()).toEqual({
        available: 1,
        sold: 0,
        soldOnCredit: 0,
        availableWeight: "3",
      });
      expect(
        (await send("GET", branchPath, undefined, "staff")).statusCode,
      ).toBe(403);
      expect(await ids("/sales", "date=2026-11-23", branchQuery)).toEqual([]);
      expect(
        (
          await dashboardSummary(
            db,
            { organizationId, storeId: branch.id },
            false,
            now,
          )
        ).comparison,
      ).toMatchObject({
        sales: [],
        saleCount: null,
        receipts: null,
        intake: null,
      });
      expect(
        await ids("/products", "receivedOn=2026-11-23", branchQuery),
      ).toHaveLength(1);
      const groupedProducts = [
        await product("Multi-sale A"),
        await product("Multi-sale B"),
      ];
      const unpaidPayload = {
        customerId: customer.id,
        items: groupedProducts.map(({ id: productId }) => ({
          productId,
          saleAmount: "50",
        })),
        payments: [],
      };
      const unpaidKey = randomUUID();
      const unpaidChallenge = await send(
        "POST",
        `/sales?${query}`,
        unpaidPayload,
        "owner",
        unpaidKey,
      );
      expect(unpaidChallenge.statusCode).toBe(409);
      const unpaid = await send(
        "POST",
        `/sales?${query}`,
        unpaidPayload,
        "owner",
        unpaidKey,
        unpaidChallenge.json().confirmation.token,
      );
      expect(unpaid.statusCode, unpaid.body).toBe(201);
      const unpaidId = unpaid.json().id;
      await db.sale.updateMany({
        where: { ...scope, id: unpaidId },
        data: { createdAt: previous },
      });
      expect(
        await ids("/sales", "paymentStatus=UNPAID&date=2026-11-22"),
      ).toEqual([unpaidId]);
      expect(await ids("/sales", "paymentDate=2026-11-22")).toEqual([
        id,
        priorId,
      ]);
      expect(await ids("/products", "status=SOLD&soldOn=2026-11-22")).toEqual(
        [second, ...groupedProducts]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map(({ id }) => id),
      );
      expect(await ids("/products", "credit=true&soldOn=2026-11-22")).toEqual(
        [...groupedProducts]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map(({ id }) => id),
      );
      expect((await send("GET", overviewPath)).json()).toMatchObject({
        sold: 4,
        soldOnCredit: 3,
      });
      const settled = await send(
        "POST",
        `/sales/${unpaidId}/payments?${query}`,
        {
          method: "CASH",
          currency: "AZN",
          amount: "100",
        },
      );
      expect(settled.statusCode, settled.body).toBe(201);
      expect(await ids("/products", "credit=true")).toEqual([first.id]);
      expect((await send("GET", overviewPath)).json()).toMatchObject({
        sold: 4,
        soldOnCredit: 1,
      });
      expect(
        (await send("GET", `/sales?${query}&paymentStatus=invalid`)).statusCode,
      ).toBe(400);
      expect(
        (await send("GET", `/products?${query}&soldOn=2026-11-31`)).statusCode,
      ).toBe(400);
      await db.storeGoldPriceRule.create({
        data: {
          ...scope,
          actorId: owner,
          purity: null,
          kind: "SCRAP_SELL",
          mode: "FIXED",
          value: "50",
          effectiveAt: new Date(Date.now() - 86_400_000),
        },
      });
      const storeHistory = await send(
        "GET",
        `${root}/gold-prices/rates/chart?period=7d&purity=585&kind=SCRAP_SELL`,
        undefined,
        "staff",
      );
      expect(storeHistory.statusCode, storeHistory.body).toBe(200);
      expect(storeHistory.json()).toMatchObject({ high: "50", low: "50" });
      const branchHistory = await send(
        "GET",
        `/organizations/${organizationId}/stores/${branch.id}/gold-prices/rates/chart?period=7d&purity=585&kind=SCRAP_SELL`,
      );
      expect(branchHistory.json()).toMatchObject({
        high: null,
        low: null,
        movement: null,
      });
      expect(
        (await send("GET", `${root}/gold-prices/chart?period=invalid`))
          .statusCode,
      ).toBe(400);
      expect(
        (await send("GET", `${root}/gold-prices/settings`)).statusCode,
      ).toBe(403);
    } finally {
      await app.close();
    }
  },
);

test.skipIf(!db)(
  "archives published FX observations atomically and serves their actual change",
  async () => {
    if (!db) throw new Error("Test database missing");
    const owner = randomUUID();
    const app = await buildApp({
      access: { db, verifyToken: async () => ({ userId: owner }) },
      onboardingDb: db,
      salesDb: db,
    });
    let now = new Date("2096-11-20T07:00:00.000Z");
    let date = "2096-11-20";
    let eur = "1.9";
    const refresh = createExchangeRateService(
      db.officialExchangeRateSnapshot,
      () => {},
      async () => ({
        effectiveDate: date,
        rates: { USD: "1.7", EUR: eur, TRY: "0.04" },
      }),
      () => now,
      db,
    );
    const original = await db.officialExchangeRateSnapshot.findUnique({
      where: { source: "CBAR" },
    });
    try {
      await refresh();
      now = new Date("2096-11-23T07:00:00.000Z");
      await refresh(); // Same bulletin across a publication gap.
      date = "2096-11-24";
      eur = "1.995";
      now = new Date("2096-11-24T07:00:00.000Z");
      await refresh();
      const headers = { authorization: "Bearer owner" };
      const { organizationId, storeId } = (
        await app.inject({
          method: "POST",
          url: "/api/v1/onboarding",
          headers,
          payload: {
            fullName: "FX Test Owner",
            organizationName: "FX",
            storeName: "Main",
            defaultCurrency: "AZN",
          },
        })
      ).json();
      const history = await app.inject({
        headers,
        url: `/api/v1/organizations/${organizationId}/stores/${storeId}/exchange-rates/history`,
      });
      expect(history.statusCode).toBe(200);
      const data = history.json();
      expect(data.effectiveDate).toBe(date);
      expect(data.currencies.EUR.points.slice(-2)).toEqual([
        { at: "2096-11-20", value: "1.9" },
        { at: date, value: "1.995" },
      ]);
      expect(data.currencies.EUR.movement).toEqual({
        absolute: "0.095",
        percent: "5.00",
        direction: "up",
      });
      expect(data.currencies.USD.movement.direction).toBe("flat");
    } finally {
      await db.officialExchangeRateObservation.deleteMany({
        where: {
          source: "CBAR",
          effectiveDate: { gte: new Date("2096-01-01") },
        },
      });
      if (original)
        await db.officialExchangeRateSnapshot.update({
          where: { source: "CBAR" },
          data: original,
        });
      else
        await db.officialExchangeRateSnapshot.deleteMany({
          where: { source: "CBAR" },
        });
      await app.close();
    }
  },
);
