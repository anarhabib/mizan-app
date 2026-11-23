import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { createDatabase } from "@mizan/database";
import type {
  ProductDetail,
  SaleConfirmation,
  SaleResult,
} from "@mizan/contracts";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url ? createDatabase(url) : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "tracks gemstone jewelry through intake, checkout and repayment",
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
    const send = (
      method: "GET" | "POST" | "PATCH",
      path: string,
      payload?: object,
      actor = "owner",
      headers?: Record<string, string>,
    ) =>
      app.inject({
        method,
        url: "/api/v1" + path,
        payload,
        headers: { authorization: "Bearer " + actor, ...headers },
      });
    try {
      const registration = await send("POST", "/onboarding", {
        organizationName: "Jewelry integration",
        storeName: "Main store",
        defaultCurrency: "AZN",
      });
      expect(registration.statusCode).toBe(200);
      const { organizationId, storeId } = registration.json<{
        organizationId: string;
        storeId: string;
      }>();
      const scope = { organizationId, storeId };
      const query = "?" + new URLSearchParams(scope);
      const storePath = `/organizations/${organizationId}/stores/${storeId}`;
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
      expect(
        (
          await send(
            "POST",
            storePath + "/salesperson-mode",
            undefined,
            "restricted",
          )
        ).statusCode,
      ).toBe(204);
      const otherStore = await db.store.create({
        data: { organizationId, name: "Other store" },
      });
      await db.storeAssignment.create({
        data: { organizationId, storeId: otherStore.id, userId: owner.userId },
      });
      await db.storeGoldPriceRule.create({
        data: {
          ...scope,
          actorId: owner.userId,
          purity: 585,
          kind: "RETAIL_SELL",
          mode: "FIXED",
          value: "40",
        },
      });

      const productBase = {
        name: "Gold ring",
        category: "Ring",
        purity: 585,
        weight: "2.505",
      };
      const acquisitionCostPerGram = { amount: "30.05", currency: "AZN" };
      const plain = await send("POST", "/products" + query, {
        ...productBase,
        code: "PLAIN",
        netGoldWeight: "2.505",
        acquisitionCostPerGram,
      });
      expect(plain.statusCode).toBe(201);
      const plainDetail = await send(
        "GET",
        "/products/" + plain.json<ProductDetail>().id + query,
        undefined,
        "seller",
      );
      expect(plainDetail.json()).toMatchObject({
        estimatedSellingValue: { amount: "100.20", currency: "AZN" },
        acquisitionCostPerGram,
        metalType: "GOLD",
      });

      const gemstones = [
        {
          gemstoneType: "Diamond",
          stoneCount: 1,
          origin: "LAB_GROWN",
          totalCarats: "0.45501",
          individualCarats: "0.45501",
          shape: "Round",
          color: "G",
          clarity: "VS1",
          cutGrade: "Excellent",
          laboratory: "IGI",
          reportNumber: "00123",
        },
        {
          gemstoneType: "Ruby",
          stoneCount: 3,
          origin: "NATURAL",
          treatment: "Heated",
        },
      ];
      const missing = await send("POST", "/products" + query, {
        ...productBase,
        code: "UNWEIGHED",
        gemstones: [gemstones[1]],
        acquisitionCost: { amount: "82", currency: "USD" },
      });
      expect(missing.statusCode).toBe(201);
      const unweighed = await send(
        "GET",
        "/products/" + missing.json<ProductDetail>().id + query,
      );
      expect(unweighed.json()).toMatchObject({
        acquisitionCost: { amount: "82.00", currency: "USD" },
      });
      for (const field of [
        "netGoldWeight",
        "fineGoldWeight",
        "estimatedSellingValue",
        "estimatedMetalSellingValue",
      ])
        expect(unweighed.json()).not.toHaveProperty(field);

      const acquisitionCost = { amount: "160.1259", currency: "AZN" };
      const acquisitionBreakdown = {
        metal: "45.0001",
        gemstones: "100.1258",
        workmanship: "15",
        other: "0",
      };
      const fixedSellingPrice = { amount: "235.50", currency: "AZN" };
      const intake = await send("POST", "/products" + query, {
        ...productBase,
        code: "JEWELRY",
        netGoldWeight: "2.001",
        gemstones,
        acquisitionCost,
        acquisitionBreakdown,
        fixedSellingPrice,
      });
      expect(intake.statusCode).toBe(201);
      const { id } = intake.json<ProductDetail>();
      const productPath = "/products/" + id;
      const detail = (
        await send("GET", productPath + query)
      ).json<ProductDetail>();
      expect(detail).toMatchObject({
        weight: "2.505",
        netGoldWeight: "2.001",
        fineGoldWeight: "1.170585",
        gemstones,
        fixedSellingPrice,
        estimatedMetalSellingValue: { amount: "80.04", currency: "AZN" },
        acquisitionCost,
        acquisitionBreakdown,
      });
      expect(detail).not.toHaveProperty("estimatedSellingValue");
      expect(detail).not.toHaveProperty("acquisitionCostPerGram");
      for (const actor of ["seller", "restricted"]) {
        const visible = (
          await send("GET", productPath + query, undefined, actor)
        ).json();
        expect(visible).toMatchObject({ gemstones, fixedSellingPrice });
        expect(visible).not.toHaveProperty("acquisitionCost");
        expect(visible).not.toHaveProperty("acquisitionBreakdown");
        expect(
          (
            await send(
              "PATCH",
              productPath + "/acquisition" + query,
              {
                weight: "2.5",
                acquisitionCost,
              },
              actor,
            )
          ).statusCode,
        ).toBe(403);
      }
      expect(
        (
          await send(
            "GET",
            productPath +
              "?" +
              new URLSearchParams({ organizationId, storeId: otherStore.id }),
          )
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await send("PATCH", productPath + "/acquisition" + query, {
            weight: "2.505",
            acquisitionCostPerGram,
          })
        ).json(),
      ).toMatchObject({ code: "INVALID_PRODUCT", field: "acquisitionCost" });
      expect(
        (await send("GET", "/products/overview" + query)).json(),
      ).toMatchObject({
        available: 3,
        sold: 0,
        soldOnCredit: 0,
        availableWeight: "7.515",
      });
      expect(
        (
          await send(
            "GET",
            "/products" + query + "&gemstones=recorded&category=Ring",
          )
        )
          .json()
          .items.map(({ code }: { code: string }) => code),
      ).toEqual(["JEWELRY", "UNWEIGHED"]);
      expect(
        (await send("GET", "/products" + query + "&gemstones=none"))
          .json()
          .items.map(({ code }: { code: string }) => code),
      ).toEqual(["PLAIN"]);
      expect(
        (await send("GET", storePath + "/dashboard")).json(),
      ).toMatchObject({
        intake: { count: 3, weight: "7.515" },
        inventory: { count: 3, weight: "7.515" },
      });

      const customer = await send("POST", storePath + "/customers", {
        name: "Buyer",
        phone: "+994501234567",
      });
      expect(customer.statusCode).toBe(201);
      const saleInput = {
        productId: id,
        saleAmount: "140",
        customerId: customer.json().id,
        payments: [{ method: "CASH", currency: "AZN", amount: "100" }],
      };
      const headers = { "idempotency-key": "jewelry-checkout" };
      const challenge = await send(
        "POST",
        "/sales" + query,
        saleInput,
        "owner",
        headers,
      );
      expect(challenge.statusCode).toBe(409);
      const { confirmation } = challenge.json<{
        confirmation: SaleConfirmation;
      }>();
      expect(confirmation).toMatchObject({
        financials: {
          losses: [{ acquisitionCost: "160.1259", expectedLoss: "20.1259" }],
        },
        debt: { outstanding: { amount: "40", currency: "AZN" } },
      });
      const completed = await send(
        "POST",
        "/sales" + query,
        saleInput,
        "owner",
        { ...headers, "sale-confirmation": confirmation.token },
      );
      expect(completed.statusCode).toBe(201);
      const sale = completed.json<SaleResult>();
      expect(sale).toMatchObject({
        paymentStatus: "PARTIALLY_PAID",
        items: [
          {
            product: { weight: "2.505" },
            profit: {
              acquisitionCost,
              acquisitionCostPerGram: null,
              grossProfit: "-20.1259",
            },
          },
        ],
      });
      const salePath = "/sales/" + sale.id;
      const restrictedSale = (
        await send("GET", salePath + query, undefined, "restricted")
      ).json<SaleResult>();
      expect(restrictedSale).not.toHaveProperty("profit");
      expect(restrictedSale.items[0]).not.toHaveProperty("profit");
      expect(
        (await send("GET", "/products/overview" + query)).json(),
      ).toMatchObject({
        available: 2,
        sold: 1,
        soldOnCredit: 1,
        availableWeight: "5.01",
      });
      const payment = await send(
        "POST",
        salePath + "/payments" + query,
        { method: "CARD", currency: "AZN", amount: "40" },
        "owner",
        { "idempotency-key": "jewelry-payment" },
      );
      expect(payment.statusCode).toBe(201);
      expect(payment.json()).toMatchObject({
        paymentStatus: "PAID",
        items: sale.items,
      });
      expect(
        (await send("GET", "/products/overview" + query)).json(),
      ).toMatchObject({
        available: 2,
        sold: 1,
        soldOnCredit: 0,
      });
    } finally {
      await app.close();
    }
  },
);
