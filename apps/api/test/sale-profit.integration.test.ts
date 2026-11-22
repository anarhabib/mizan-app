import { createHash, randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { createDatabase } from "@mizan/database";
import type {
  SaleConfirmation,
  SaleCreateInput,
  SaleResult,
} from "@mizan/contracts";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url ? createDatabase(url) : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "confirms individual losses, snapshots multi-product profit and redacts restricted receipts",
  async () => {
    if (!db) throw new Error("Test database missing");
    const owner = { userId: randomUUID(), sessionId: randomUUID() };
    const restricted = { ...owner, sessionId: randomUUID() };
    const seller = { userId: randomUUID(), sessionId: randomUUID() };
    const identities = new Map(Object.entries({ owner, restricted, seller }));
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) => identities.get(token) ?? null,
      },
      onboardingDb: db,
      products: { db },
      salesDb: db,
    });
    try {
      const onboard = await app.inject({
        method: "POST",
        url: "/api/v1/onboarding",
        headers: { authorization: "Bearer owner" },
        payload: {
          organizationName: "Profit test",
          storeName: "Store",
          defaultCurrency: "AZN",
        },
      });
      expect(onboard.statusCode).toBe(200);
      const { organizationId, storeId } = onboard.json();
      const scope = { organizationId, storeId };
      const query = "?" + new URLSearchParams(scope).toString();
      await db.user.create({ data: { id: seller.userId } });
      await db.organizationMembership.create({
        data: { organizationId, userId: seller.userId, role: "SALESPERSON" },
      });
      await db.storeAssignment.create({
        data: { ...scope, userId: seller.userId },
      });
      await db.organization.update({
        where: { id: organizationId },
        data: { salespersonCanViewAcquisitionCost: true },
      });
      const switchMode = (actor: string) =>
        app.inject({
          method: "POST",
          url: `/api/v1/organizations/${organizationId}/stores/${storeId}/salesperson-mode`,
          headers: { authorization: `Bearer ${actor}` },
        });
      expect((await switchMode("restricted")).statusCode).toBe(204);

      const product = (
        code: string,
        acquisitionCost: string,
        acquisitionCostPerGram: string | null,
        acquisitionCurrency = "AZN",
      ) =>
        db.product.create({
          data: {
            ...scope,
            code,
            name: code,
            category: "Ring",
            purity: 585,
            weight: "2",
            acquisitionCost,
            acquisitionCostPerGram,
            acquisitionCurrency,
          },
        });
      const [first, second, free, missing, foreign, legacy] = await Promise.all(
        [
          product("PROFIT", "60", "30"),
          product("DISCOUNTED", "100", "50"),
          product("FREE", "10", "5"),
          product("NO-COST", "0", null),
          product("FOREIGN", "900", "450", "USD"),
          product("LEGACY", "300", "150"),
        ],
      );
      const rate = await db.storeGoldPriceRule.create({
        data: {
          organizationId,
          storeId,
          actorId: owner.userId,
          purity: 585,
          kind: "SCRAP_BUY",
          mode: "FIXED",
          value: "30",
        },
      });
      const items = [
        { productId: first.id, saleAmount: "150" },
        { productId: second.id, saleAmount: "80" },
      ];
      const payload: SaleCreateInput = {
        items,
        tradeIns: [
          { rateId: rate.id, purity: 585, weight: "2", overrideAmount: "70" },
        ],
        payment: { currency: "AZN", amount: "200" },
      };
      const send = (
        key: string,
        body: SaleCreateInput,
        actor = "owner",
        token?: string,
      ) =>
        app.inject({
          method: "POST",
          url: "/api/v1/sales" + query,
          headers: {
            authorization: `Bearer ${actor}`,
            "idempotency-key": key,
            ...(token && { "sale-confirmation": token }),
          },
          payload: body,
        });
      const read = (path: string, actor = "owner", params = "") =>
        app.inject({
          method: "GET",
          url: "/api/v1" + path + query + params,
          headers: { authorization: `Bearer ${actor}` },
        });
      const challenge = async (response: Awaited<ReturnType<typeof send>>) => {
        expect(response.statusCode).toBe(409);
        expect(response.json().code).toBe("SALE_CONFIRMATION_REQUIRED");
        return response.json<{ confirmation: SaleConfirmation }>().confirmation;
      };

      expect(
        (await send("duplicate", { items: [items[0], items[0]] })).statusCode,
      ).toBe(400);
      expect(
        (
          await send("underpaid", {
            ...payload,
            payment: { currency: "AZN", amount: "155" },
          })
        ).json().code,
      ).toBe("SALE_CUSTOMER_REQUIRED");
      const ownerChallenge = await challenge(await send("multi", payload));
      expect(ownerChallenge.financials).toEqual({
        currency: "AZN",
        losses: [
          {
            productId: second.id,
            code: second.code,
            acquisitionCost: "100",
            saleAmount: "80",
            expectedLoss: "20",
          },
        ],
      });
      expect(
        await challenge(
          await send(
            "multi",
            { ...payload, confirmed: true } as SaleCreateInput,
            "owner",
            "A".repeat(43),
          ),
        ),
      ).toEqual(ownerChallenge);
      for (const actor of ["restricted", "seller"]) {
        const warning = await challenge(
          await send("multi", payload, actor, ownerChallenge.token),
        );
        expect(Object.keys(warning)).toEqual(["token"]);
        expect(warning.token).not.toBe(ownerChallenge.token);
      }
      expect(
        await challenge(
          await send("other-key", payload, "owner", ownerChallenge.token),
        ),
      ).not.toEqual(ownerChallenge);
      expect(
        await challenge(
          await send(
            "multi",
            {
              ...payload,
              items: [items[0], { ...items[1], saleAmount: "79" }],
            },
            "owner",
            ownerChallenge.token,
          ),
        ),
      ).not.toEqual(ownerChallenge);
      expect(await db.sale.count({ where: scope })).toBe(0);
      expect(await db.inventoryMovement.count({ where: scope })).toBe(0);
      expect(
        await db.product.count({ where: { ...scope, status: "SOLD" } }),
      ).toBe(0);

      const secondKey = {
        organizationId_storeId_id: { ...scope, id: second.id },
      };
      await db.product.update({
        where: secondKey,
        data: { acquisitionCost: "110", acquisitionCostPerGram: "55" },
      });
      const refreshed = await challenge(
        await send("multi", payload, "owner", ownerChallenge.token),
      );
      expect(refreshed.financials?.losses[0].expectedLoss).toBe("30");
      const [completed, replay] = await Promise.all([
        send("multi", payload, "owner", refreshed.token),
        send("multi", payload, "owner", refreshed.token),
      ]);
      expect(completed.statusCode).toBe(201);
      expect(replay.json()).toEqual(completed.json());
      const sale = completed.json<SaleResult>();
      expect(sale).toMatchObject({
        saleAmount: "230",
        tradeInTotal: "70",
        balance: "160",
        payment: { amount: "200", change: "40" },
        profit: {
          acquisitionCost: { amount: "170", currency: "AZN" },
          grossProfit: "60",
          marginPercent: "26.09",
        },
        items: [
          {
            product: { id: first.id },
            saleAmount: "150",
            profit: { grossProfit: "90", marginPercent: "60" },
          },
          {
            product: { id: second.id },
            saleAmount: "80",
            profit: {
              acquisitionCostPerGram: { amount: "55", currency: "AZN" },
              grossProfit: "-30",
              marginPercent: "-37.5",
            },
          },
        ],
      });
      expect(
        await db.inventoryMovement.count({
          where: { ...scope, saleId: sale.id, kind: "PRODUCT_SOLD" },
        }),
      ).toBe(2);
      expect((await read(`/products/${second.id}`)).json().sale).toMatchObject({
        id: sale.id,
        total: { amount: "80.00" },
      });
      const history = (await read("/sales", "owner", "&q=DISCOUNTED")).json();
      expect(history.items).toMatchObject([{ id: sale.id, itemCount: 2 }]);
      expect(history.items[0]).not.toHaveProperty("profit");
      await db.product.update({
        where: secondKey,
        data: { acquisitionCost: "400", acquisitionCostPerGram: "200" },
      });
      expect((await read(`/sales/${sale.id}`)).json()).toEqual(sale);
      for (const actor of ["seller", "restricted"]) {
        const detail = (
          await read(`/sales/${sale.id}`, actor)
        ).json<SaleResult>();
        expect(detail).not.toHaveProperty("profit");
        for (const line of detail.items)
          expect(line).not.toHaveProperty("profit");
      }
      const restrictedReplay = await send("multi", payload, "restricted");
      expect(restrictedReplay.statusCode).toBe(201);
      expect(restrictedReplay.json()).not.toHaveProperty("profit");
      expect(restrictedReplay.json().items[1]).not.toHaveProperty("profit");

      const freePayload = { productId: free.id, saleAmount: "0" };
      const freeChallenge = await challenge(
        await send("free", freePayload, "seller"),
      );
      const freeSale = await send(
        "free",
        freePayload,
        "seller",
        freeChallenge.token,
      );
      expect(freeSale.statusCode).toBe(201);
      expect(freeSale.json()).not.toHaveProperty("profit");
      expect((await read(`/sales/${freeSale.json().id}`)).json()).toMatchObject(
        {
          payment: null,
          profit: { grossProfit: "-10", marginPercent: null },
        },
      );

      const staleBasket = await send("stale-basket", {
        items: [{ productId: missing.id, saleAmount: "100" }, items[1]],
      });
      expect(staleBasket.statusCode).toBe(409);
      expect(staleBasket.json().code).toBe("SALE_CONFLICT");
      expect((await read(`/products/${missing.id}`)).json().status).toBe(
        "IN_STOCK",
      );

      const noCostSale = await send("unavailable", {
        items: [
          { productId: missing.id, saleAmount: "100" },
          { productId: foreign.id, saleAmount: "100" },
        ],
      });
      expect(noCostSale.statusCode).toBe(201);
      expect(noCostSale.json()).toMatchObject({
        profit: {
          acquisitionCost: null,
          grossProfit: null,
          marginPercent: null,
        },
        items: [
          { profit: { acquisitionCost: null, grossProfit: null } },
          {
            profit: {
              acquisitionCost: { amount: "900", currency: "USD" },
              grossProfit: null,
            },
          },
        ],
      });

      const legacyPayload = { productId: legacy.id, saleAmount: "400" };
      const legacyReceipt = await db.sale.create({
        data: {
          ...scope,
          ...legacyPayload,
          actorId: owner.userId,
          idempotencyKey: "legacy",
          requestDigest: createHash("sha256")
            .update(JSON.stringify({ ...legacyPayload, tradeIns: [] }))
            .digest("hex"),
          currency: "AZN",
          defaultCurrency: "AZN",
          exchangeRate: "1",
          defaultSaleAmount: "400",
          acceptedTradeInTotal: "0",
          defaultAcceptedTradeInTotal: "0",
          settlement: "400",
          defaultSettlement: "400",
          outstandingDebt: "0",
          productCode: legacy.code,
          productName: legacy.name,
          productCategory: legacy.category,
          productPurity: legacy.purity,
          productWeight: legacy.weight,
        },
      });
      const legacyReplay = await send("legacy", legacyPayload);
      expect(legacyReplay.statusCode).toBe(201);
      expect(legacyReplay.json()).toMatchObject({
        id: legacyReceipt.id,
        items: [
          {
            saleAmount: "400",
            profit: {
              acquisitionCost: null,
              acquisitionCostPerGram: null,
              grossProfit: null,
            },
          },
        ],
      });
    } finally {
      await app.close();
    }
  },
);
