import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { createDatabase } from "@mizan/database";
import type { SaleCreateInput } from "@mizan/contracts";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url ? createDatabase(url) : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "records a scoped sale, keeps the cash snapshot, and safely handles competing requests",
  async () => {
    if (!db) throw new Error("Test database missing");
    const userId = randomUUID();
    const otherId = randomUUID();
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) =>
          token === "owner"
            ? { userId }
            : token === "other"
              ? { userId: otherId }
              : null,
      },
      onboardingDb: db,
      salesDb: db,
      products: { db },
    });
    try {
      const registration = await app.inject({
        method: "POST",
        url: "/api/v1/onboarding",
        headers: { authorization: "Bearer owner" },
        payload: {
          organizationName: "Sales test",
          storeName: "Main store",
          defaultCurrency: "AZN",
        },
      });
      expect(registration.statusCode).toBe(200);
      const { organizationId, storeId } = registration.json<{
        organizationId: string;
        storeId: string;
      }>();
      const scope = { organizationId, storeId };
      const query = new URLSearchParams(scope).toString();
      const product = await db.product.create({
        data: {
          ...scope,
          code: "R-1",
          name: "Ring",
          category: "Ring",
          purity: 585,
          weight: "2.333",
          acquisitionCost: "70",
          acquisitionCurrency: "AZN",
        },
      });
      const rate = await db.oldGoldRate.create({
        data: {
          organizationId,
          actorId: userId,
          purity: 585,
          currency: "AZN",
          amountPerGram: "15",
        },
      });
      const payload = {
        productId: product.id,
        expectedCurrency: "AZN",
        saleAmount: "200",
        tradeIns: [{ purity: 585, weight: "2.000", rateId: rate.id }],
        payment: { currency: "USD", amount: "110", exchangeRate: "1.70" },
      };
      const send = (
        key: string,
        body: SaleCreateInput = payload,
        actor = "owner",
      ) =>
        app.inject({
          method: "POST",
          url: `/api/v1/sales?${query}`,
          headers: { authorization: `Bearer ${actor}`, "idempotency-key": key },
          payload: body,
        });

      expect((await send("denied", payload, "other")).statusCode).toBe(403);
      const staleCurrency = await send("stale-currency", {
        ...payload,
        expectedCurrency: "USD",
      });
      expect(staleCurrency.statusCode).toBe(409);
      expect(staleCurrency.json()).toMatchObject({
        code: "SALE_CONFLICT",
        field: "currency",
      });
      expect(
        (
          await send("stale", {
            ...payload,
            tradeIns: [{ ...payload.tradeIns[0], rateId: randomUUID() }],
          })
        ).statusCode,
      ).toBe(409);
      const underpaid = await send("underpaid", {
        ...payload,
        payment: { ...payload.payment, amount: "99" },
      });
      expect(underpaid.statusCode).toBe(400);
      expect(underpaid.json()).toMatchObject({
        code: "SALE_PAYMENT_TOO_LOW",
        field: "payment.amount",
      });
      expect(
        await db.product.findUnique({
          where: { organizationId_storeId_id: { ...scope, id: product.id } },
        }),
      ).toMatchObject({ status: "IN_STOCK" });
      const [first, simultaneousRetry, competitor] = await Promise.all([
        send("same"),
        send("same"),
        send("different"),
      ]);
      expect(first.statusCode).toBe(simultaneousRetry.statusCode);
      expect([first.statusCode, competitor.statusCode].sort()).toEqual([
        201, 409,
      ]);
      const created = (first.statusCode === 201 ? first : competitor).json();
      const winningKey = first.statusCode === 201 ? "same" : "different";
      expect(created).toMatchObject({
        currency: "AZN",
        saleAmount: "200",
        balance: "170",
        payout: "0",
        payment: {
          currency: "USD",
          amount: "110",
          exchangeRate: "1.7",
          convertedAmount: "187",
          change: "17",
        },
        product: { code: "R-1", weight: "2.333", status: "SOLD" },
        tradeIns: [{ acceptedValue: "30", appliedRate: "15" }],
        profit: {
          acquisitionCost: { amount: "70", currency: "AZN" },
          grossProfit: "130",
          marginPercent: "65",
        },
      });
      const deletion = await app.inject({
        method: "DELETE",
        url: `/api/v1/products/${product.id}?${query}`,
        headers: { authorization: "Bearer owner" },
      });
      expect(deletion.statusCode).toBe(409);
      expect(deletion.json()).toHaveProperty("code", "PRODUCT_DELETE_CONFLICT");
      expect(
        await db.tradeIn.count({ where: { ...scope, saleId: created.id } }),
      ).toBe(1);
      expect((await send(winningKey)).json()).toEqual(created);
      expect(
        (await send(winningKey, { ...payload, saleAmount: "201" })).statusCode,
      ).toBe(409);
      expect(await db.sale.count({ where: scope })).toBe(1);
      expect(
        await db.inventoryMovement.count({
          where: { ...scope, saleId: created.id },
        }),
      ).toBe(2);
      expect(await db.receivedOldGold.count({ where: scope })).toBe(1);
      await db.product.updateMany({ where: scope, data: { name: "Renamed" } });
      const history = await app.inject({
        method: "GET",
        url: `/api/v1/sales/${created.id}?${query}`,
        headers: { authorization: "Bearer owner" },
      });
      expect(history.statusCode).toBe(200);
      expect(history.json()).toEqual(created);
      const inventoryHistory = (search: string, actor = "owner") =>
        app.inject({
          method: "GET",
          url: `/api/v1/sales?${query}&${search}`,
          headers: { authorization: `Bearer ${actor}` },
        });
      expect((await inventoryHistory("q=R-1")).json()).toMatchObject({
        items: [
          { id: created.id, product: { name: "Ring" }, saleAmount: "200" },
        ],
      });
      expect(
        (await inventoryHistory("q=" + created.id.slice(0, 8))).json(),
      ).toMatchObject({
        items: [{ id: created.id }],
      });
      expect((await inventoryHistory("q=Renamed")).json()).toMatchObject({
        items: [],
      });
      expect((await inventoryHistory("date=2026-02-31")).statusCode).toBe(400);
      expect((await inventoryHistory("q=R-1", "other")).statusCode).toBe(403);

      const options = await app.inject({
        method: "GET",
        url: `/api/v1/sales/options?${query}`,
        headers: { authorization: "Bearer owner" },
      });
      expect(options.json()).toEqual({
        currency: "AZN",
        rates: [{ id: rate.id, purity: 585, amountPerGram: "15" }],
      });

      const makeProduct = (code: string) =>
        db.product.create({
          data: {
            ...scope,
            code,
            name: "Ring",
            category: "Ring",
            purity: 585,
            weight: "1",
            acquisitionCost: "2",
            acquisitionCurrency: "AZN",
          },
        });
      const ordinary = await makeProduct("R-2");
      const ordinarySale = await send("ordinary", {
        productId: ordinary.id,
        saleAmount: "50",
      });
      expect(ordinarySale.statusCode).toBe(201);
      expect(ordinarySale.json()).toMatchObject({
        balance: "50",
        payment: {
          currency: "AZN",
          amount: "50",
          exchangeRate: "1",
          change: "0",
        },
      });

      const payout = await makeProduct("R-3");
      const payoutSale = await send("payout", {
        productId: payout.id,
        saleAmount: "20",
        tradeIns: [
          { purity: 585, weight: "2", rateId: rate.id, overrideAmount: "40" },
        ],
      });
      expect(payoutSale.statusCode).toBe(201);
      expect(payoutSale.json()).toMatchObject({
        balance: "-20",
        payout: "20",
        payment: null,
        profit: { grossProfit: "18", marginPercent: "90" },
        tradeIns: [
          { calculatedValue: "30", acceptedValue: "40", overridden: true },
        ],
      });

      const rollbackItem = await makeProduct("TASK10-ROLLBACK");
      const rollbackPayload = { ...payload, productId: rollbackItem.id };
      await db.$executeRaw`CREATE FUNCTION "mizan".test_task10_rollback() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.kind = 'OLD_GOLD_RECEIVED' AND EXISTS (
            SELECT 1 FROM "mizan"."Sale" WHERE "organizationId" = NEW."organizationId"
              AND "storeId" = NEW."storeId" AND id = NEW."saleId" AND "productCode" = 'TASK10-ROLLBACK'
          ) THEN RAISE EXCEPTION 'Test sale rollback'; END IF;
          RETURN NEW;
        END;
      $$`;
      try {
        await db.$executeRaw`CREATE TRIGGER test_task10_rollback BEFORE INSERT ON "mizan"."InventoryMovement"
          FOR EACH ROW EXECUTE FUNCTION "mizan".test_task10_rollback()`;
        expect((await send("rollback", rollbackPayload)).statusCode).toBe(500);
        expect(await db.sale.count({ where: scope })).toBe(3);
        expect(await db.tradeIn.count({ where: scope })).toBe(2);
        expect(await db.receivedOldGold.count({ where: scope })).toBe(2);
        expect(await db.inventoryMovement.count({ where: scope })).toBe(5);
        expect(
          await db.product.findFirst({
            where: { ...scope, id: rollbackItem.id },
          }),
        ).toMatchObject({ status: "IN_STOCK" });
      } finally {
        await db.$executeRaw`DROP TRIGGER IF EXISTS test_task10_rollback ON "mizan"."InventoryMovement"`;
        await db.$executeRaw`DROP FUNCTION "mizan".test_task10_rollback()`;
      }
      await db.purityGrade.update({
        where: { organizationId_value: { organizationId, value: 585 } },
        data: { active: false },
      });
      expect((await send("inactive", rollbackPayload)).statusCode).toBe(409);
      await db.organization.update({
        where: { id: organizationId },
        data: { defaultCurrency: "USD" },
      });
      expect((await send(winningKey)).json()).toEqual(created);
    } finally {
      await app.close();
    }
  },
);
