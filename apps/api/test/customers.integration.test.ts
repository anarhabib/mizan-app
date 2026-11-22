import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { createDatabase } from "@mizan/database";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url ? createDatabase(url) : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "scopes customers and derives AZN balances from linked receipts",
  async () => {
    if (!db) throw new Error("Test database missing");
    const ownerId = randomUUID();
    const staffId = randomUUID();
    const restrictedSession = randomUUID();
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) =>
          token === "staff"
            ? { userId: staffId }
            : token === "restricted"
              ? { userId: ownerId, sessionId: restrictedSession }
              : token === "owner"
                ? { userId: ownerId }
                : null,
      },
      onboardingDb: db,
      salesDb: db,
    });
    const headers = (role: string) => ({ authorization: `Bearer ${role}` });
    try {
      const registration = await app.inject({
        method: "POST",
        url: "/api/v1/onboarding",
        headers: headers("owner"),
        payload: {
          organizationName: "Customer test",
          storeName: "Main",
          defaultCurrency: "AZN",
        },
      });
      expect(registration.statusCode).toBe(200);
      const { organizationId, storeId } = registration.json();
      const scope = { organizationId, storeId };
      const otherStore = await db.store.create({
        data: { organizationId, name: "Branch" },
      });
      await db.user.create({ data: { id: staffId } });
      await db.organizationMembership.create({
        data: { organizationId, userId: staffId, role: "SALESPERSON" },
      });
      await db.storeAssignment.createMany({
        data: [
          { ...scope, userId: staffId },
          { organizationId, storeId: otherStore.id, userId: ownerId },
        ],
      });
      await db.salespersonDisplaySession.create({
        data: { sessionId: restrictedSession, userId: ownerId },
      });
      const directory = (store = storeId) =>
        `/api/v1/organizations/${organizationId}/stores/${store}/customers`;
      const add = (
        name: string,
        store = storeId,
        role = "staff",
        note?: string,
      ) =>
        app.inject({
          method: "POST",
          url: directory(store),
          headers: headers(role),
          payload: { name, phone: "+994 (50) 123-45-67", note },
        });
      const created = await add("Nigar Ə.", storeId, "staff", "  Call first  ");
      expect(created.statusCode).toBe(201);
      const customer = created.json();
      const branchCustomer = (
        await add("Branch client", otherStore.id, "owner")
      ).json();
      const detailPath = `${directory()}/${customer.id}`;
      const get = (url: string, role = "staff") =>
        app.inject({ url, headers: headers(role) });
      expect((await get(detailPath)).json().note).toBe("Call first");
      expect((await get(directory(otherStore.id))).statusCode).toBe(403);
      expect(
        (await get(`${directory(otherStore.id)}/${customer.id}`, "owner"))
          .statusCode,
      ).toBe(404);
      expect((await get(`${directory()}?q=5012345`)).json().items).toEqual([
        expect.objectContaining({
          ...customer,
          outstandingDebt: { amount: "0.00", currency: "AZN" },
          lastPurchaseAt: null,
        }),
      ]);
      expect((await get(`${directory()}?q=nigar`)).json().items).toHaveLength(
        1,
      );
      const updated = await app.inject({
        method: "PATCH",
        url: detailPath,
        headers: headers("staff"),
        payload: {
          name: "Nigar Əliyeva",
          phone: customer.phone,
          note: "Preferred contact\nAfter 5 pm",
        },
      });
      expect(updated.json().name).toBe("Nigar Əliyeva");
      expect((await get(detailPath)).json().note).toBe(
        "Preferred contact\nAfter 5 pm",
      );
      expect((await get(directory())).json().items[0]).not.toHaveProperty(
        "note",
      );
      const createProduct = (code: string, currency = "AZN") =>
        db.product.create({
          data: {
            ...scope,
            code,
            name: code,
            category: "Rings",
            purity: 585,
            weight: "2",
            acquisitionCost: "10",
            acquisitionCurrency: currency,
          },
        });
      const [partial, anonymous, unpaid, foreign] = await Promise.all([
        createProduct("Partial"),
        createProduct("Anonymous"),
        createProduct("Unpaid"),
        createProduct("Foreign", "USD"),
      ]);
      const rate = await db.oldGoldRate.create({
        data: {
          organizationId,
          actorId: ownerId,
          purity: 585,
          currency: "AZN",
          amountPerGram: "10",
        },
      });
      const query = new URLSearchParams(scope);
      const salePath = `/api/v1/sales?${query}`;
      const sell = (key: string, payload: object) =>
        app.inject({
          method: "POST",
          url: salePath,
          headers: { ...headers("staff"), "idempotency-key": key },
          payload,
        });
      const terms = {
        productId: partial.id,
        saleAmount: "200.05",
        tradeIns: [{ purity: 585, weight: "2", rateId: rate.id }],
        payment: { currency: "USD", amount: "50", exchangeRate: "1.7" },
      };
      expect((await sell("short", terms)).json().code).toBe(
        "SALE_PAYMENT_TOO_LOW",
      );
      expect(
        (await sell("missing", { ...terms, recordDebt: true })).json().code,
      ).toBe("SALE_CUSTOMER_REQUIRED");
      expect(
        (
          await sell("other-store", {
            ...terms,
            recordDebt: true,
            customerId: branchCustomer.id,
          })
        ).json().code,
      ).toBe("CUSTOMER_NOT_FOUND");
      expect(await db.sale.count({ where: scope })).toBe(0);
      const payload = { ...terms, recordDebt: true, customerId: customer.id };
      const recorded = await sell("partial", payload);
      expect(recorded.statusCode).toBe(201);
      const receipt = recorded.json();
      expect(receipt).toMatchObject({
        customerId: customer.id,
        outstandingDebt: "95.05",
        balance: "180.05",
        payment: { amount: "50", convertedAmount: "85", change: "0" },
      });
      expect((await sell("partial", payload)).json()).toEqual(receipt);
      expect(
        (
          await sell("partial", { ...payload, customerId: branchCustomer.id })
        ).json().code,
      ).toBe("SALE_CONFLICT");
      const noCustomer = await sell("anonymous", {
        productId: anonymous.id,
        saleAmount: "42",
      });
      expect(noCustomer.statusCode).toBe(201);
      expect(noCustomer.json().payment.amount).toBe("42");
      expect(noCustomer.json()).not.toHaveProperty("customerId");
      const noTender = await sell("unpaid", {
        productId: unpaid.id,
        saleAmount: "35.10",
        customerId: customer.id,
        recordDebt: true,
      });
      expect(noTender.statusCode).toBe(201);
      expect(noTender.json()).toMatchObject({
        outstandingDebt: "35.1",
        payment: null,
      });
      await db.organization.update({
        where: { id: organizationId },
        data: { defaultCurrency: "USD" },
      });
      const foreignTerms = {
        productId: foreign.id,
        saleAmount: "20.25",
        customerId: customer.id,
        recordDebt: true,
      };
      expect((await sell("foreign", foreignTerms)).json()).toMatchObject({
        code: "INVALID_SALE",
        field: "customerReportingRate",
      });
      expect(
        (
          await sell("foreign", {
            ...foreignTerms,
            customerReportingRate: "1.713",
          })
        ).statusCode,
      ).toBe(201);
      const summary = (await get(detailPath)).json();
      expect(summary).toMatchObject({
        totalPurchases: { amount: "269.84", currency: "AZN" },
        outstandingDebt: { amount: "164.84", currency: "AZN" },
        lastPurchaseAt: expect.any(String),
      });
      const history = (await get(`${detailPath}/purchases`)).json();
      expect(history.items).toHaveLength(3);
      const partialPurchase = history.items.find(
        ({ id }: { id: string }) => id === receipt.id,
      );
      expect(partialPurchase).toEqual({
        id: receipt.id,
        createdAt: receipt.createdAt,
        itemCount: 1,
        productName: "Partial",
        total: { amount: "200.05", currency: "AZN" },
        outstandingDebt: { amount: "95.05", currency: "AZN" },
        payment: { amount: "50", currency: "USD" },
      });
      expect(
        (await get(`/api/v1/sales/${receipt.id}?${query}`)).json(),
      ).not.toHaveProperty("profit");
      for (const role of ["staff", "restricted", "owner"]) {
        const response = await app.inject({
          method: "DELETE",
          url: detailPath,
          headers: headers(role),
        });
        expect(response.statusCode).toBe(role === "owner" ? 409 : 403);
      }
      const unused = (await add("Unused")).json();
      const removed = await app.inject({
        method: "DELETE",
        url: `${directory()}/${unused.id}`,
        headers: headers("owner"),
      });
      expect(removed.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  },
  15_000,
);

test.skipIf(!db)(
  "paginates the directory with stable ordering and scoped cursors",
  async () => {
    if (!db) throw new Error("Test database missing");
    const userId = randomUUID();
    const app = await buildApp({
      access: { db, verifyToken: async () => ({ userId }) },
      onboardingDb: db,
      salesDb: db,
    });
    try {
      const headers = { authorization: "Bearer owner" };
      const setup = await app.inject({
        method: "POST",
        url: "/api/v1/onboarding",
        headers,
        payload: {
          organizationName: "Directory test",
          storeName: "Main",
          defaultCurrency: "AZN",
        },
      });
      expect(setup.statusCode).toBe(200);
      const { organizationId, storeId } = setup.json();
      await db.customer.createMany({
        data: Array.from({ length: 51 }, (_, index) => ({
          organizationId,
          storeId,
          name: `Client ${index}`,
          phone: "555-1234",
          phoneDigits: "5551234",
          createdAt: new Date("2026-11-22T00:00:00Z"),
        })),
      });
      const url = `/api/v1/organizations/${organizationId}/stores/${storeId}/customers`;
      const first = (
        await app.inject({ url: `${url}?q=555-12`, headers })
      ).json();
      expect(first.items).toHaveLength(50);
      const next = (
        await app.inject({
          url: `${url}?q=555-12&after=${first.nextCursor}`,
          headers,
        })
      ).json();
      expect(next.items).toHaveLength(1);
      expect(first.items.map(({ id }: { id: string }) => id)).not.toContain(
        next.items[0].id,
      );
      expect(
        (await app.inject({ url: `${url}?after=${randomUUID()}`, headers }))
          .statusCode,
      ).toBe(400);
    } finally {
      await app.close();
    }
  },
);
