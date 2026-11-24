import { randomUUID } from "node:crypto";
import type {
  ProductDetail,
  ProductRegistrationInput,
  ProductRegistrationReceipt,
  PurchaseDetail,
} from "@mizan/contracts";
import { createDatabase } from "@mizan/database";
import { expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");

test.skipIf(!url)(
  "registers independent stock and purchases atomically with scoped historical links and replay",
  async () => {
    const db = createDatabase(url!);
    const owner = { userId: randomUUID(), sessionId: randomUUID() };
    const staff = { userId: randomUUID(), sessionId: randomUUID() };
    const restricted = { ...owner, sessionId: randomUUID() };
    const actors = { owner, staff, restricted };
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) =>
          actors[token as keyof typeof actors] ?? null,
      },
      onboardingDb: db,
      salesDb: db,
      products: { db },
      goldMarketEnabled: false,
    });
    const request = (
      method: "GET" | "POST" | "PATCH" | "DELETE",
      path: string,
      payload?: object,
      key?: string,
      role: keyof typeof actors = "owner",
    ) =>
      app.inject({
        method,
        url: "/api/v1" + path,
        payload,
        headers: {
          authorization: "Bearer " + role,
          ...(key && { "Idempotency-Key": key }),
        },
      });
    try {
      const onboarding = await request("POST", "/onboarding", {
        organizationName: "Registration test",
        storeName: "Main",
        defaultCurrency: "AZN",
        fullName: "Original actor",
      });
      expect(onboarding.statusCode, onboarding.body).toBe(200);
      const { organizationId, storeId } = onboarding.json();
      const scope = { organizationId, storeId };
      const store = `/organizations/${organizationId}/stores/${storeId}`;
      const qs = "?" + new URLSearchParams(scope);
      const second = await db.store.create({
        data: { organizationId, name: "Branch" },
      });
      await db.storeAssignment.create({
        data: { organizationId, storeId: second.id, userId: owner.userId },
      });
      await db.user.create({ data: { id: staff.userId } });
      await db.organizationMembership.create({
        data: { organizationId, userId: staff.userId, role: "SALESPERSON" },
      });
      await db.storeAssignment.create({
        data: { ...scope, userId: staff.userId },
      });
      expect(
        (
          await request(
            "POST",
            store + "/salesperson-mode",
            undefined,
            undefined,
            "restricted",
          )
        ).statusCode,
      ).toBe(204);
      const supplier = await db.supplier.create({
        data: { ...scope, name: "Recorded Supplier" },
      });
      const foreignSupplier = await db.supplier.create({
        data: { organizationId, storeId: second.id, name: "Foreign" },
      });
      const category = await db.productCategory.findFirstOrThrow({
        where: { organizationId, isActive: true },
      });
      const item = (code: string, amount = "500.00") => ({
        code,
        name: `Ring ${code}`,
        categoryId: category.id,
        purity: 585,
        weight: "2.345",
        netGoldWeight: "2.111",
        acquisitionCost: { amount, currency: "AZN" },
        fixedSellingPrice: { amount: "1800.00", currency: "AZN" },
      });
      const register = (
        body: ProductRegistrationInput,
        key = randomUUID(),
        role: keyof typeof actors = "owner",
        query = qs,
      ) => request("POST", "/products/registration" + query, body, key, role);
      const product = (id: string, role: keyof typeof actors = "owner") =>
        request("GET", "/products/" + id + qs, undefined, undefined, role);
      const fixtureKey = randomUUID();
      const opening = {
        source: "OPENING_STOCK",
        historicalSupplierId: supplier.id,
        products: [item("O-1"), item("O-2")],
      } as const;
      const stockBody: ProductRegistrationInput = {
        ...opening,
        products: [...opening.products],
      };
      const first = await register(stockBody, fixtureKey);
      expect(first.statusCode, first.body).toBe(201);
      const stock = first.json<ProductRegistrationReceipt>();
      expect(stock.productIds).toHaveLength(2);
      expect(stock.purchaseId).toBeUndefined();
      expect((await register(stockBody, fixtureKey)).json()).toEqual(stock);
      const conflicting = await register(
        { ...stockBody, source: "OTHER" },
        fixtureKey,
      );
      expect(conflicting.statusCode).toBe(409);
      expect(await db.purchase.count({ where: scope })).toBe(0);
      expect(await db.supplierPayment.count({ where: scope })).toBe(0);
      expect(
        await db.inventoryMovement.count({
          where: {
            ...scope,
            actorId: owner.userId,
            registrationSource: "OPENING_STOCK",
          },
        }),
      ).toBe(2);
      expect(
        (await product(stock.productIds[0])).json<ProductDetail>(),
      ).toMatchObject({
        registrationSource: "OPENING_STOCK",
        historicalSupplier: { id: supplier.id, name: supplier.name },
        movements: [
          {
            actorId: owner.userId,
            actorName: "Original actor",
            registrationSource: "OPENING_STOCK",
          },
        ],
      });
      expect(
        (await product(stock.productIds[0], "staff")).json(),
      ).not.toHaveProperty("historicalSupplier");

      const other = await register(
        { source: "OTHER", products: [item("OTHER")] },
        randomUUID(),
        "staff",
      );
      expect(other.statusCode, other.body).toBe(201);
      const otherId = other.json<ProductRegistrationReceipt>().productIds[0];
      const historicalPath =
        "/products/" + otherId + "/historical-supplier" + qs;
      expect(
        (
          await request(
            "PATCH",
            historicalPath,
            { supplierId: supplier.id },
            undefined,
            "staff",
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await request("PATCH", historicalPath, {
            supplierId: foreignSupplier.id,
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (await request("PATCH", historicalPath, { supplierId: supplier.id }))
          .statusCode,
      ).toBe(204);
      expect(
        (await request("PATCH", historicalPath, { supplierId: supplier.id }))
          .statusCode,
      ).toBe(204);
      expect(
        await db.supplierActivity.count({
          where: {
            ...scope,
            kind: "HISTORICAL_PRODUCT_LINKED",
            productId: otherId,
          },
        }),
      ).toBe(1);
      expect(await db.purchase.count({ where: scope })).toBe(0);

      const purchase: ProductRegistrationInput = {
        source: "SUPPLIER_PURCHASE",
        purchase: {
          supplierId: supplier.id,
          purchaseDate: "2026-11-24",
          currency: "AZN",
          documentNumber: "REF-23",
          note: "Recorded note",
        },
        products: [
          {
            ...item("P-1", "1250.00"),
            acquisitionBreakdown: { metal: "1000", gemstones: "250" },
            gemstones: [
              {
                gemstoneType: "Diamond",
                stoneCount: 1,
                origin: "NATURAL",
                totalCarats: "0.125",
              },
            ],
          },
          { ...item("P-2", "1250.00"), weight: "3.123" },
        ],
        initialPayment: { amount: "1500", currency: "AZN", method: "CASH" },
      };
      for (const actor of ["staff", "restricted"] as const)
        expect((await register(purchase, randomUUID(), actor)).statusCode).toBe(
          403,
        );
      expect(
        (
          await register({
            ...purchase,
            purchase: { ...purchase.purchase, supplierId: foreignSupplier.id },
          })
        ).statusCode,
      ).toBe(404);
      const branchQuery =
        "?" + new URLSearchParams({ organizationId, storeId: second.id });
      expect(
        (await register(purchase, randomUUID(), "owner", branchQuery))
          .statusCode,
      ).toBe(404);
      const invalidCategory = await register({
        ...purchase,
        products: [
          purchase.products[0],
          { ...item("P-2"), categoryId: randomUUID() },
        ],
      });
      expect(invalidCategory.json()).toMatchObject({
        code: "CATEGORY_UNAVAILABLE",
        field: "products.1.categoryId",
      });
      const duplicated = await register({
        ...purchase,
        products: [purchase.products[0], purchase.products[0]],
      });
      expect(duplicated.json()).toMatchObject({
        code: "INVALID_PRODUCT",
        field: "products.1.code",
      });
      const usedCode = await register({
        ...purchase,
        products: [purchase.products[0], item("O-2")],
      });
      expect(usedCode.json()).toMatchObject({
        code: "PRODUCT_CODE_CONFLICT",
        field: "products.1.code",
      });
      const wrongCurrency = await register({
        ...purchase,
        initialPayment: { ...purchase.initialPayment!, currency: "USD" },
      });
      expect(wrongCurrency.json()).toMatchObject({
        code: "INVALID_PRODUCT",
        field: "initialPayment.currency",
      });
      const excessive = await register({
        ...purchase,
        initialPayment: { ...purchase.initialPayment!, amount: "2500.0001" },
      });
      expect(excessive.json()).toMatchObject({
        code: "SUPPLIER_OVERPAYMENT",
        field: "initialPayment.amount",
      });
      expect(await db.product.count({ where: scope })).toBe(3);
      expect(await db.inventoryMovement.count({ where: scope })).toBe(3);
      expect(await db.purchase.count({ where: scope })).toBe(0);
      expect(await db.supplierPayment.count({ where: scope })).toBe(0);
      expect(
        await db.supplierActivity.count({
          where: { ...scope, purchaseId: { not: null } },
        }),
      ).toBe(0);

      const purchaseKey = randomUUID();
      const paidResponses = await Promise.all([
        register(purchase, purchaseKey),
        register(purchase, purchaseKey),
      ]);
      for (const response of paidResponses)
        expect(response.statusCode, response.body).toBe(201);
      const receipt = paidResponses[0].json<ProductRegistrationReceipt>();
      expect(paidResponses[1].json()).toEqual(receipt);
      const purchasePath = store + "/purchases/" + receipt.purchaseId;
      const detail = (
        await request("GET", purchasePath)
      ).json<PurchaseDetail>();
      expect(detail).toMatchObject({
        productCount: 2,
        grossWeight: "5.468",
        status: "PARTIALLY_PAID",
        total: { amount: "2500", currency: "AZN" },
        paid: { amount: "1500", currency: "AZN" },
        outstanding: { amount: "1000", currency: "AZN" },
        note: "Recorded note",
        actorName: "Original actor",
      });
      expect(detail.products.map(({ id, weight }) => [id, weight])).toEqual([
        [receipt.productIds[0], "2.345"],
        [receipt.productIds[1], "3.123"],
      ]);
      expect(detail.products[0].gemstones).toMatchObject([
        { gemstoneType: "Diamond", totalCarats: "0.125" },
      ]);
      expect(
        await db.inventoryMovement.count({
          where: { ...scope, registrationSource: "SUPPLIER_PURCHASE" },
        }),
      ).toBe(2);
      expect(
        await db.supplierPayment.count({
          where: { ...scope, isInitial: true },
        }),
      ).toBe(1);
      expect((await product(receipt.productIds[0])).json()).toMatchObject({
        registrationSource: "SUPPLIER_PURCHASE",
        purchase: {
          id: receipt.purchaseId,
          supplierId: supplier.id,
          supplierName: supplier.name,
          documentNumber: "REF-23",
          purchaseDate: "2026-11-24",
        },
        canEditAcquisition: false,
        canDelete: false,
      });
      for (const actor of ["staff", "restricted"] as const) {
        const restrictedDetail = (
          await product(receipt.productIds[0], actor)
        ).json();
        expect(restrictedDetail).not.toHaveProperty("purchase");
        expect(restrictedDetail).not.toHaveProperty("registrationSource");
        expect(restrictedDetail).not.toHaveProperty("acquisitionCost");
      }
      const purchasedId = receipt.productIds[0];
      expect(
        (
          await request(
            "PATCH",
            "/products/" + purchasedId + "/acquisition" + qs,
            item("rewrite"),
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (await request("DELETE", "/products/" + purchasedId + qs)).statusCode,
      ).toBe(409);

      const payment = {
        amount: "1000",
        currency: "AZN",
        method: "CASH",
        paymentDate: "2026-11-24",
      };
      const concurrent = await Promise.all([
        request("POST", purchasePath + "/payments", payment, randomUUID()),
        request("POST", purchasePath + "/payments", payment, randomUUID()),
      ]);
      expect(concurrent.map(({ statusCode }) => statusCode).sort()).toEqual([
        201, 409,
      ]);
      expect((await request("GET", purchasePath)).json()).toMatchObject({
        status: "PAID",
        outstanding: { amount: "0" },
      });
      await db.supplier.update({
        where: { organizationId_storeId_id: { ...scope, id: supplier.id } },
        data: { name: "Renamed supplier" },
      });
      await db.user.update({
        where: { id: owner.userId },
        data: { fullName: "Updated actor" },
      });
      expect((await request("GET", purchasePath)).json()).toMatchObject({
        supplier: { name: "Recorded Supplier" },
        actorName: "Updated actor",
      });
      expect((await product(stock.productIds[0])).json()).toMatchObject({
        historicalSupplier: { name: "Recorded Supplier" },
      });

      for (const [code, initialAmount, status] of [
        ["UNPAID", undefined, "UNPAID"],
        ["PAID", "500", "PAID"],
      ]) {
        const response = await register({
          ...purchase,
          products: [item(code!)],
          ...(initialAmount
            ? {
                initialPayment: {
                  ...purchase.initialPayment!,
                  amount: initialAmount,
                },
              }
            : { initialPayment: undefined }),
        });
        expect(response.statusCode, response.body).toBe(201);
        expect(
          (
            await request(
              "GET",
              store + "/purchases/" + response.json().purchaseId,
            )
          ).json(),
        ).toMatchObject({ status });
      }
      await db.supplier.update({
        where: { organizationId_storeId_id: { ...scope, id: supplier.id } },
        data: { isActive: false },
      });
      expect(
        (await register({ ...purchase, products: [item("INACTIVE")] })).json(),
      ).toMatchObject({ code: "SUPPLIER_INACTIVE" });
      expect((await register(purchase, purchaseKey)).json()).toEqual(receipt);
    } finally {
      await app.close();
      await db.$disconnect();
    }
  },
);
