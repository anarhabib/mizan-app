import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { createDatabase } from "@mizan/database";
import type {
  ProductDetail,
  PurchaseDetail,
  PurchaseReceipt,
  Supplier,
  SupplierOverview,
  SupplierPage,
  SupplierPayment,
} from "@mizan/contracts";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url ? createDatabase(url) : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "supplier ledger preserves scoped stock, exact purchase amounts and concurrent allocations",
  async () => {
    if (!db) throw new Error("Test database missing");
    const owner = { userId: randomUUID(), sessionId: randomUUID() };
    const restricted = { ...owner, sessionId: randomUUID() };
    const staff = { userId: randomUUID(), sessionId: randomUUID() };
    const outsider = { userId: randomUUID(), sessionId: randomUUID() };
    const identities = new Map(
      Object.entries({ owner, restricted, staff, outsider }),
    );
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) => identities.get(token) ?? null,
      },
      onboardingDb: db,
      products: { db },
      salesDb: db,
      goldMarketEnabled: false,
    });
    const send = (
      method: "GET" | "POST" | "PATCH",
      path: string,
      payload?: object,
      key?: string,
      actor = "owner",
    ) =>
      app.inject({
        method,
        url: "/api/v1" + path,
        payload,
        headers: {
          authorization: "Bearer " + actor,
          ...(key && { "Idempotency-Key": key }),
        },
      });
    const data = async <T>(
      request: ReturnType<typeof send>,
      status = 200,
    ): Promise<T> => {
      const response = await request;
      expect(response.statusCode, response.body).toBe(status);
      return response.json<T>();
    };
    const scopePath = ({
      organizationId,
      storeId,
    }: {
      organizationId: string;
      storeId: string;
    }) => `/organizations/${organizationId}/stores/${storeId}`;
    const onboard = async (actor: string) => {
      const { organizationId, storeId } = await data<{
        organizationId: string;
        storeId: string;
      }>(
        send(
          "POST",
          "/onboarding",
          {
            organizationName: actor + " supplier test",
            storeName: "Main",
            defaultCurrency: "AZN",
            fullName: "Ledger Owner",
          },
          undefined,
          actor,
        ),
      );
      return { organizationId, storeId };
    };
    try {
      const scope = await onboard("owner");
      const { organizationId } = scope;
      const other = await onboard("outsider");
      const secondStore = await db.store.create({
        data: { organizationId, name: "Branch" },
      });
      await db.storeAssignment.create({
        data: { organizationId, storeId: secondStore.id, userId: owner.userId },
      });
      await db.user.create({ data: { id: staff.userId } });
      await db.organizationMembership.create({
        data: { organizationId, userId: staff.userId, role: "SALESPERSON" },
      });
      await db.storeAssignment.create({
        data: { ...scope, userId: staff.userId },
      });
      await db.organization.update({
        where: { id: organizationId },
        data: { salespersonCanViewAcquisitionCost: true },
      });
      const store = scopePath(scope);
      const branchScope = { organizationId, storeId: secondStore.id };
      const branch = scopePath(branchScope);
      const suppliers = store + "/suppliers";
      const purchases = store + "/purchases";
      expect(
        (
          await send(
            "POST",
            store + "/salesperson-mode",
            undefined,
            undefined,
            "restricted",
          )
        ).statusCode,
      ).toBe(204);

      expect(
        (await send("POST", suppliers, { name: "A", email: "invalid" }))
          .statusCode,
      ).toBe(400);
      const contact = {
        name: "North Jewels",
        contactPerson: "Leyla Aliyeva",
        phone: "+994 (50) 123-4567",
      };
      const supplier = await data<Supplier>(
        send("POST", suppliers, contact),
        201,
      );
      const sameName = await data<Supplier>(
        send("POST", suppliers, contact),
        201,
      );
      expect(sameName.id).not.toBe(supplier.id);
      const supplierPath = suppliers + "/" + supplier.id;
      expect(
        await data(
          send("PATCH", supplierPath, {
            taxId: "TAX-502",
            note: "Private supplier",
          }),
        ),
      ).toMatchObject({ ...contact, name: supplier.name, taxId: "TAX-502" });
      expect(
        (
          await data<SupplierPage<Supplier>>(
            send("GET", suppliers + "?q=Aliyeva"),
          )
        ).items,
      ).toHaveLength(2);
      expect(
        (
          await data<SupplierPage<Supplier>>(
            send("GET", suppliers + "?q=5012345"),
          )
        ).items,
      ).toHaveLength(2);
      expect(
        (await send("GET", branch + "/suppliers/" + supplier.id)).statusCode,
      ).toBe(404);
      expect(
        (
          await send(
            "GET",
            scopePath(other) + "/suppliers/" + supplier.id,
            undefined,
            undefined,
            "outsider",
          )
        ).statusCode,
      ).toBe(404);
      expect(
        (await send("GET", supplierPath, undefined, undefined, "outsider"))
          .statusCode,
      ).toBe(403);

      const category = await db.productCategory.findFirstOrThrow({
        where: { organizationId },
      });
      const tag = randomUUID().slice(0, 10);
      const perGram = (code: string, currency = "AZN") => ({
        code: tag + code,
        name: code,
        categoryId: category.id,
        purity: 585,
        weight: "1.000",
        acquisitionCostPerGram: { amount: "10.1234", currency },
      });
      const productsPath = "/products?" + new URLSearchParams(scope);
      const existing = await data<ProductDetail>(
        send("POST", productsPath, perGram("existing")),
        201,
      );
      const branchProduct = await data<ProductDetail>(
        send(
          "POST",
          "/products?" + new URLSearchParams(branchScope),
          perGram("branch"),
        ),
        201,
      );
      const productPath = (id: string) =>
        "/products/" + id + "?" + new URLSearchParams(scope);
      const staffBefore = await data<ProductDetail>(
        send("GET", productPath(existing.id), undefined, undefined, "staff"),
      );
      expect(staffBefore.acquisitionCost?.amount).toBe("10.1234");

      const dashboard = `${store}/dashboard/owner`;
      expect(
        (await data<{ intakeCost: unknown }>(send("GET", dashboard)))
          .intakeCost,
      ).toEqual([{ amount: "10.1234", currency: "AZN" }]);
      const date = "2026-11-20";
      const receipt = (items: object[], currency = "AZN") => ({
        supplierId: supplier.id,
        purchaseDate: date,
        currency,
        items,
      });
      expect(
        (
          await send(
            "POST",
            purchases,
            receipt([{ productId: branchProduct.id }]),
            "wrong-store",
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await send(
            "POST",
            purchases,
            receipt([{ productId: existing.id }], "USD"),
            "wrong-currency",
          )
        ).statusCode,
      ).toBe(400);

      const jewelry = {
        ...perGram("gemstone"),
        acquisitionCostPerGram: undefined,
      };
      const body = {
        ...receipt([
          { productId: existing.id },
          {
            product: {
              ...perGram("fractional"),
              weight: "2.500",
              acquisitionCostPerGram: { amount: "4.0001", currency: "AZN" },
            },
          },
          {
            product: {
              ...jewelry,
              weight: "3.100",
              netGoldWeight: "2.700",
              gemstones: [
                {
                  gemstoneType: "Diamond",
                  stoneCount: 2,
                  totalCarats: "0.125",
                  origin: "NATURAL",
                },
              ],
              acquisitionCost: { amount: "20.0069", currency: "AZN" },
              acquisitionBreakdown: {
                metal: "10",
                gemstones: "8.0069",
                workmanship: "2",
              },
            },
          },
        ]),
        documentNumber: "NJ-22",
      };
      const [first, duplicate] = await Promise.all([
        data<PurchaseReceipt>(
          send("POST", purchases, body, "receipt-one"),
          201,
        ),
        data<PurchaseReceipt>(
          send("POST", purchases, body, "receipt-one"),
          201,
        ),
      ]);
      expect(first).toEqual(duplicate);
      expect(first.productIds[0]).toBe(existing.id);
      expect(
        (
          await send(
            "POST",
            purchases,
            { ...body, note: "changed" },
            "receipt-one",
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await send(
            "POST",
            purchases,
            receipt([{ productId: existing.id }]),
            "link-twice",
          )
        ).statusCode,
      ).toBe(409);
      const failed = await send(
        "POST",
        purchases,
        receipt([
          { product: perGram("rollback") },
          { product: perGram("existing") },
        ]),
        "rollback",
      );
      expect(failed.statusCode).toBe(409);
      expect(failed.json()).toMatchObject({
        code: "PRODUCT_CODE_CONFLICT",
        field: "items.1.code",
      });
      expect(
        await db.product.count({ where: { ...scope, code: tag + "rollback" } }),
      ).toBe(0);
      expect(
        await db.inventoryMovement.count({
          where: { ...scope, kind: "PRODUCT_ADDED" },
        }),
      ).toBe(3);
      expect(
        (await data<{ intakeCost: unknown }>(send("GET", dashboard)))
          .intakeCost,
      ).toEqual([{ amount: "40.1306", currency: "AZN" }]);

      const purchasePath = purchases + "/" + first.id;
      expect(
        (await send("GET", branch + "/purchases/" + first.id)).statusCode,
      ).toBe(404);
      const purchase = await data<PurchaseDetail>(send("GET", purchasePath));
      expect(purchase).toMatchObject({
        actorName: "Ledger Owner",
        total: { amount: "40.1306", currency: "AZN" },
        status: "UNPAID",
        productCount: 3,
      });
      expect(purchase.products[2]).toMatchObject({
        netGoldWeight: "2.7",
        gemstones: [{ gemstoneType: "Diamond", totalCarats: "0.125" }],
        acquisitionBreakdown: { gemstones: "8.0069" },
      });
      expect(
        (await data<ProductDetail>(send("GET", productPath(existing.id))))
          .purchase,
      ).toEqual({
        id: first.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        documentNumber: "NJ-22",
        purchaseDate: "2026-11-20",
      });
      expect(
        (
          await send(
            "PATCH",
            "/products/" +
              existing.id +
              "/acquisition?" +
              new URLSearchParams(scope),
            {
              weight: "1",
              acquisitionCostPerGram: { amount: "1", currency: "AZN" },
            },
          )
        ).statusCode,
      ).toBe(409);
      for (const actor of ["staff", "restricted"]) {
        for (const [method, path, payload] of [
          ["GET", suppliers],
          ["GET", supplierPath],
          ["GET", supplierPath + "/products"],
          ["GET", supplierPath + "/payments"],
          ["GET", supplierPath + "/activity"],
          ["GET", purchasePath],
          ["POST", purchasePath + "/payments", {}],
          ["POST", purchases, {}],
          ["PATCH", supplierPath, {}],
          ["GET", productsPath + "&unpurchased=true"],
        ] as const)
          expect(
            (await send(method, path, payload, undefined, actor)).statusCode,
          ).toBe(403);
        const row = await data<ProductDetail>(
          send("GET", productPath(existing.id), undefined, undefined, actor),
        );
        expect(row).not.toHaveProperty("purchase");
        expect(row).not.toHaveProperty("acquisitionCost");
        expect(row).not.toHaveProperty("acquisitionCostPerGram");
      }

      const usd = await data<PurchaseReceipt>(
        send(
          "POST",
          purchases,
          receipt([{ product: perGram("usd", "USD") }], "USD"),
          "usd",
        ),
        201,
      );
      const second = await data<PurchaseReceipt>(
        send(
          "POST",
          purchases,
          receipt([{ product: perGram("same-currency") }]),
          "another-azn",
        ),
        201,
      );
      const paymentPath = purchasePath + "/payments";
      const payment = (amount: string, currency = "AZN") => ({
        amount,
        currency,
        method: "TRANSFER",
        paymentDate: date,
        referenceNumber: "PAY-1",
      });
      expect(
        (
          await send(
            "POST",
            paymentPath,
            payment("10", "USD"),
            "bad-payment-currency",
          )
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await send(
            "POST",
            paymentPath,
            { ...payment("1"), paymentDate: "2026-11-19" },
            "too-early",
          )
        ).statusCode,
      ).toBe(400);
      expect(
        (await send("POST", paymentPath, payment("41"), "overpaid")).statusCode,
      ).toBe(409);
      expect((await send("POST", paymentPath, payment("1"))).statusCode).toBe(
        400,
      );

      const [p1, replay] = await Promise.all([
        data<SupplierPayment>(
          send("POST", paymentPath, payment("10.1234"), "partial"),
          201,
        ),
        data<SupplierPayment>(
          send("POST", paymentPath, payment("10.1234"), "partial"),
          201,
        ),
      ]);
      expect(p1).toEqual(replay);
      expect(p1).toMatchObject({
        actorName: "Ledger Owner",
        amount: "10.1234",
        purchaseId: first.id,
        referenceNumber: "PAY-1",
      });
      expect(
        (await send("POST", paymentPath, payment("10.999"), "partial"))
          .statusCode,
      ).toBe(409);
      expect(
        await data<PurchaseDetail>(send("GET", purchasePath)),
      ).toMatchObject({
        status: "PARTIALLY_PAID",
        outstanding: { amount: "30.0072" },
      });

      const queried = await data<SupplierPage<PurchaseDetail>>(
        send(
          "GET",
          purchases +
            `?status=PARTIALLY_PAID&from=${date}&through=${date}&currency=AZN&supplierId=${supplier.id}`,
        ),
      );
      expect(queried.items.map(({ id }) => id)).toEqual([first.id]);
      const payable = await data<SupplierOverview>(send("GET", supplierPath));
      expect(payable).toMatchObject({
        purchaseCount: 3,
        productCount: 5,
        lastPurchaseDate: date,
        lastPaymentDate: date,
        balances: [
          {
            currency: "AZN",
            purchased: { amount: "50.254" },
            paid: { amount: "10.1234" },
            outstanding: { amount: "40.1306" },
          },
          {
            currency: "USD",
            purchased: { amount: "10.1234" },
            paid: { amount: "0" },
            outstanding: { amount: "10.1234" },
          },
        ],
      });
      expect(
        (
          await data<SupplierPage<Supplier>>(
            send("GET", suppliers + "?outstanding=true"),
          )
        ).items.map(({ id }) => id),
      ).toEqual([supplier.id]);

      await data(
        send("PATCH", supplierPath, { isActive: false, name: "North Jewelry" }),
      );
      expect(
        (
          await data<SupplierPage<Supplier>>(
            send("GET", suppliers + "?active=false"),
          )
        ).items.map(({ id }) => id),
      ).toEqual([supplier.id]);
      expect(
        (
          await send(
            "POST",
            purchases,
            receipt([{ product: perGram("inactive") }]),
            "inactive",
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await data<SupplierPage<SupplierPayment>>(
            send("GET", supplierPath + "/payments"),
          )
        ).items,
      ).toEqual([p1]);

      const concurrent = await Promise.all([
        send("POST", paymentPath, payment("25"), "racing-one"),
        send("POST", paymentPath, payment("25"), "racing-two"),
      ]);
      expect(concurrent.map((response) => response.statusCode).sort()).toEqual([
        201, 409,
      ]);
      await data(
        send(
          "POST",
          paymentPath,
          { ...payment("5.0072"), method: "CARD" },
          "full",
        ),
        201,
      );
      expect(
        await data<PurchaseDetail>(send("GET", purchasePath)),
      ).toMatchObject({
        status: "PAID",
        paid: { amount: "40.1306" },
        outstanding: { amount: "0" },
      });
      expect(
        (await data<PurchaseDetail>(send("GET", purchases + "/" + second.id)))
          .outstanding.amount,
      ).toBe("10.1234");
      expect(
        (await data<PurchaseDetail>(send("GET", purchases + "/" + usd.id)))
          .outstanding,
      ).toEqual({ amount: "10.1234", currency: "USD" });
      expect(
        (
          await data<SupplierPage<SupplierPayment>>(
            send(
              "GET",
              supplierPath +
                `/payments?method=TRANSFER&purchaseId=${first.id}&from=${date}&through=${date}`,
            ),
          )
        ).items.map(({ amount }) => amount),
      ).toEqual(["25", "10.1234"]);
      expect(
        (
          await data<SupplierPage<SupplierPayment>>(
            send("GET", supplierPath + `/payments?purchaseId=${second.id}`),
          )
        ).items,
      ).toEqual([]);
      expect(
        await db.inventoryMovement.count({
          where: { ...scope, kind: "PRODUCT_ADDED" },
        }),
      ).toBe(5);
      expect(await db.salePayment.count({ where: scope })).toBe(0);
      expect(await db.sale.count({ where: scope })).toBe(0);

      await data(send("PATCH", supplierPath, { isActive: true }));
      const activity = await data<
        SupplierPage<{ kind: string; actorName: string }>
      >(send("GET", supplierPath + "/activity?limit=25"));
      expect(activity.items.map(({ kind }) => kind)).toEqual([
        "REACTIVATED",
        "PAID",
        "PAYMENT_RECORDED",
        "PAYMENT_RECORDED",
        "DEACTIVATED",
        "UPDATED",
        "PARTIALLY_PAID",
        "PAYMENT_RECORDED",
        "PRODUCTS_RECEIVED",
        "PURCHASE_REGISTERED",
        "PRODUCTS_RECEIVED",
        "PURCHASE_REGISTERED",
        "PRODUCTS_RECEIVED",
        "PURCHASE_REGISTERED",
        "UPDATED",
        "CREATED",
      ]);
      expect(
        activity.items.every(({ actorName }) => actorName === "Ledger Owner"),
      ).toBe(true);
      const productHistory = await data<SupplierPage<ProductDetail>>(
        send(
          "GET",
          supplierPath +
            "/products?categoryId=" +
            category.id +
            "&purity=585&status=IN_STOCK",
        ),
      );
      expect(productHistory.items).toHaveLength(5);
      expect(
        productHistory.items.find(({ id }) => id === existing.id),
      ).toMatchObject({
        purchaseDate: date,
        acquisitionCost: { amount: "10.1234", currency: "AZN" },
      });

      await db.supplier.createMany({
        data: Array.from({ length: 11 }, (_, index) => ({
          ...scope,
          name: `Page supplier ${index}`,
        })),
      });
      const page = await data<SupplierPage<Supplier>>(
        send("GET", suppliers + "?q=Page%20supplier"),
      );
      const next = await data<SupplierPage<Supplier>>(
        send("GET", suppliers + "?q=Page%20supplier&after=" + page.nextCursor),
      );
      expect(page.items).toHaveLength(10);
      expect(next.items).toHaveLength(1);
      expect(page.items.some(({ id }) => id === next.items[0].id)).toBe(false);
    } finally {
      await app.close();
    }
  },
  30_000,
);
