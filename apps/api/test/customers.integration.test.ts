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
      products: { db },
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
      const sell = (key: string, payload: object, token?: string) =>
        app.inject({
          method: "POST",
          url: salePath,
          headers: {
            ...headers("staff"),
            "idempotency-key": key,
            ...(token && { "sale-confirmation": token }),
          },
          payload,
        });
      const terms = {
        productId: partial.id,
        saleAmount: "200.05",
        tradeIns: [{ purity: 585, weight: "2", rateId: rate.id }],
        payments: [
          {
            method: "CARD",
            currency: "USD",
            amount: "50",
            exchangeRate: "1.7",
          },
          { method: "TRANSFER", currency: "AZN", amount: "25" },
          {
            method: "CASH",
            currency: "EUR",
            amount: "0.01",
            exchangeRate: "1.5",
          },
        ],
      };
      expect((await sell("short", terms)).json().code).toBe(
        "SALE_CUSTOMER_REQUIRED",
      );
      for (const [field, value] of [
        ["amount", "-1"],
        ["amount", "0"],
        ["currency", "XYZ"],
      ]) {
        const invalid = await sell("invalid", {
          ...terms,
          payments: [{ ...terms.payments[0], [field]: value }],
        });
        expect(invalid.json()).toMatchObject({
          code: "INVALID_SALE",
          field: `payments.0.${field}`,
        });
      }
      expect(
        (
          await sell("overpaid", {
            ...terms,
            payments: [{ method: "CASH", currency: "AZN", amount: "180.06" }],
          })
        ).json().code,
      ).toBe("SALE_PAYMENT_EXCEEDS_BALANCE");
      expect(
        (
          await sell("other-store", {
            ...terms,
            customerId: branchCustomer.id,
          })
        ).json().code,
      ).toBe("CUSTOMER_NOT_FOUND");
      expect(await db.sale.count({ where: scope })).toBe(0);
      const previewResponse = await app.inject({
        method: "POST",
        url: `/api/v1/sales/preview?${query}`,
        headers: headers("staff"),
        payload: {
          saleAmounts: [terms.saleAmount],
          tradeIns: terms.tradeIns,
          payments: terms.payments,
        },
      });
      expect(previewResponse.json()).toMatchObject({
        saleAmount: "200.05",
        tradeInTotal: "20",
        amountDue: "180.05",
        paidAmount: "110.02",
        outstandingDebt: "70.03",
        overpayment: "0",
      });
      const payload = { ...terms, customerId: customer.id };
      const challenge = await sell("partial", payload);
      expect(challenge.statusCode).toBe(409);
      expect(challenge.json()).toMatchObject({
        code: "SALE_CONFIRMATION_REQUIRED",
        confirmation: {
          debt: {
            total: { amount: "200.05", currency: "AZN" },
            tradeIn: { amount: "20", currency: "AZN" },
            paid: { amount: "110.02", currency: "AZN" },
            outstanding: { amount: "70.03", currency: "AZN" },
          },
        },
      });
      expect(await db.sale.count({ where: scope })).toBe(0);
      const token = challenge.json().confirmation.token;
      expect(
        (await sell("partial", { ...payload, saleAmount: "201" }, token))
          .statusCode,
      ).toBe(409);
      const [recorded, retry] = await Promise.all([
        sell("partial", payload, token),
        sell("partial", payload, token),
      ]);
      expect(recorded.statusCode).toBe(201);
      const receipt = recorded.json();
      expect(receipt).toMatchObject({
        customerId: customer.id,
        outstandingDebt: "70.03",
        balance: "180.05",
        paymentStatus: "PARTIALLY_PAID",
        payments: [
          {
            currency: "USD",
            amount: "50",
            convertedAmount: "85",
            amountAzn: "85.00",
            method: "CARD",
          },
          {
            currency: "AZN",
            amount: "25",
            convertedAmount: "25",
            amountAzn: "25.00",
            method: "TRANSFER",
          },
          {
            currency: "EUR",
            amount: "0.01",
            convertedAmount: "0.02",
            amountAzn: "0.02",
            method: "CASH",
          },
        ],
      });
      expect(retry.json()).toEqual(receipt);
      expect((await sell("partial", payload)).json()).toEqual(receipt);
      expect(
        (
          await sell("partial", { ...payload, customerId: branchCustomer.id })
        ).json().code,
      ).toBe("SALE_CONFLICT");
      const noCustomer = await sell("anonymous", {
        productId: anonymous.id,
        saleAmount: "42.01",
        payments: [
          {
            method: "CASH",
            currency: "USD",
            amount: "24.71",
            exchangeRate: "1.7",
          },
        ],
      });
      expect(noCustomer.statusCode).toBe(201);
      expect(noCustomer.json()).toMatchObject({
        paymentStatus: "PAID",
        outstandingDebt: "0",
        payments: [{ amount: "24.71", amountAzn: "42.01" }],
      });
      expect(noCustomer.json()).not.toHaveProperty("customerId");
      const confirm = async (key: string, input: object) => {
        const first = await sell(key, input);
        expect(first.statusCode).toBe(409);
        return sell(key, input, first.json().confirmation.token);
      };
      const noTender = await confirm("unpaid", {
        productId: unpaid.id,
        saleAmount: "35.10",
        customerId: customer.id,
        payments: [],
      });
      expect(noTender.statusCode).toBe(201);
      expect(noTender.json()).toMatchObject({
        outstandingDebt: "35.1",
        paymentStatus: "UNPAID",
        payments: [],
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
        payments: [],
      };
      expect((await sell("foreign", foreignTerms)).json()).toMatchObject({
        code: "INVALID_SALE",
        field: "customerReportingRate",
      });
      const foreignSale = await confirm("foreign", {
        ...foreignTerms,
        customerReportingRate: "1.713",
      });
      expect(foreignSale.statusCode).toBe(201);
      const summary = (await get(detailPath)).json();
      expect(summary).toMatchObject({
        totalPurchases: { amount: "269.84", currency: "AZN" },
        outstandingDebt: { amount: "139.82", currency: "AZN" },
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
        tradeInCredit: { amount: "20", currency: "AZN" },
        paidAmount: { amount: "110.02", currency: "AZN" },
        outstandingDebt: { amount: "70.03", currency: "AZN" },
        payment: null,
      });
      expect(
        (await get(`/api/v1/sales/${receipt.id}?${query}`)).json(),
      ).not.toHaveProperty("profit");
      const productPath = `/api/v1/products/${partial.id}?${query}`;
      expect((await get(productPath)).json()).toMatchObject({
        status: "SOLD",
        hasOutstandingDebt: true,
      });
      const products = (
        await get(`/api/v1/products?${query}&status=SOLD`)
      ).json();
      expect(products.items).toContainEqual(
        expect.objectContaining({
          id: partial.id,
          status: "SOLD",
          hasOutstandingDebt: true,
        }),
      );
      const repay = (key: string, payment: object, saleId = receipt.id) =>
        app.inject({
          method: "POST",
          url: `/api/v1/sales/${saleId}/payments?${query}`,
          headers: { ...headers("staff"), "idempotency-key": key },
          payload: payment,
        });
      const firstRepayment = {
        method: "CARD",
        currency: "USD",
        amount: "10",
        exchangeRate: "1.7",
      };
      const repayments = await Promise.all([
        repay("repay", firstRepayment),
        repay("repay", firstRepayment),
      ]);
      for (const repayment of repayments) {
        expect(repayment.statusCode).toBe(201);
        expect(repayment.json()).toMatchObject({
          outstandingDebt: "53.03",
          paidAmount: "127.02",
          paymentStatus: "PARTIALLY_PAID",
        });
        expect(repayment.json().payments).toHaveLength(4);
        expect(repayment.json().payments[3]).toMatchObject({
          kind: "REPAYMENT",
          amount: "10",
          amountAzn: "17.00",
        });
      }
      expect(
        (await repay("repay", { ...firstRepayment, amount: "11" })).json(),
      ).toMatchObject({
        code: "SALE_CONFLICT",
        field: "idempotencyKey",
      });
      const competing = { method: "TRANSFER", currency: "AZN", amount: "40" };
      const race = await Promise.all([
        repay("race-a", competing),
        repay("race-b", competing),
      ]);
      expect(race.map(({ statusCode }) => statusCode).sort()).toEqual([
        201, 409,
      ]);
      expect(
        race.find(({ statusCode }) => statusCode === 409)?.json(),
      ).toMatchObject({ code: "SALE_PAYMENT_EXCEEDS_BALANCE" });
      const final = { method: "CASH", currency: "AZN", amount: "13.03" };
      await db.$executeRaw`CREATE FUNCTION "mizan".test_task11_repayment_rollback() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW."idempotencyKey" = 'fail-repayment' THEN RAISE EXCEPTION 'Test repayment rollback'; END IF;
          RETURN NEW;
        END;
      $$`;
      try {
        await db.$executeRaw`CREATE TRIGGER test_task11_repayment_rollback BEFORE INSERT ON "mizan"."SalePayment"
          FOR EACH ROW EXECUTE FUNCTION "mizan".test_task11_repayment_rollback()`;
        expect((await repay("fail-repayment", final)).statusCode).toBe(500);
        expect(
          (await get(`/api/v1/sales/${receipt.id}?${query}`)).json(),
        ).toMatchObject({ outstandingDebt: "13.03" });
      } finally {
        await db.$executeRaw`DROP TRIGGER IF EXISTS test_task11_repayment_rollback ON "mizan"."SalePayment"`;
        await db.$executeRaw`DROP FUNCTION "mizan".test_task11_repayment_rollback()`;
      }
      const settled = await repay("final", final);
      expect(settled.statusCode).toBe(201);
      expect(settled.json()).toMatchObject({
        paymentStatus: "PAID",
        outstandingDebt: "0",
        saleAmount: "200.05",
        paidAmount: "180.05",
      });
      expect(settled.json().payments).toHaveLength(6);
      expect((await repay("final", final)).json()).toEqual(settled.json());
      expect((await repay("already-paid", final)).json()).toMatchObject({
        code: "SALE_PAYMENT_NOT_DUE",
      });
      expect((await get(productPath)).json()).toMatchObject({ status: "SOLD" });
      expect((await get(productPath)).json()).not.toHaveProperty(
        "hasOutstandingDebt",
      );
      expect((await get(detailPath)).json()).toMatchObject({
        totalPurchases: { amount: "269.84", currency: "AZN" },
        outstandingDebt: { amount: "69.79", currency: "AZN" },
      });
      expect(await db.sale.count({ where: scope })).toBe(4);
      await db.organization.update({
        where: { id: organizationId },
        data: { defaultCurrency: "EUR" },
      });
      const foreignRepayment = await repay(
        "foreign-repayment",
        { method: "TRANSFER", currency: "AZN", amount: "17.13" },
        foreignSale.json().id,
      );
      expect(foreignRepayment.statusCode).toBe(201);
      expect(foreignRepayment.json()).toMatchObject({
        currency: "USD",
        saleAmount: "20.25",
        paidAmount: "10",
        outstandingDebt: "10.25",
        payments: [
          {
            currency: "AZN",
            amount: "17.13",
            amountAzn: "17.13",
            convertedAmount: "10",
          },
        ],
      });
      expect((await get(detailPath)).json()).toMatchObject({
        totalPurchases: { amount: "269.84", currency: "AZN" },
        outstandingDebt: { amount: "52.66", currency: "AZN" },
      });
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
