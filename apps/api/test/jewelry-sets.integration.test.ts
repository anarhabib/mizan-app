import { randomUUID } from "node:crypto";
import type {
  JewelrySetDetail,
  JewelrySetList,
  JewelrySetPreview,
  ProductDetail,
  ProductList,
  ProductRegistrationReceipt,
  SupplierOverview,
} from "@mizan/contracts";
import { createDatabase } from "@mizan/database";
import { expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");

test.skipIf(!url)(
  "manages scoped set membership without changing products or the supplier ledger",
  async () => {
    const db = createDatabase(url!);
    const identity = () => ({ userId: randomUUID(), sessionId: randomUUID() });
    const owner = identity();
    const staff = identity();
    const outsider = identity();
    const display = { ...owner, sessionId: randomUUID() };
    const actors = { owner, staff, outsider, display };
    type Actor = keyof typeof actors;
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) => actors[token as Actor] ?? null,
      },
      onboardingDb: db,
      products: { db },
      salesDb: db,
      goldMarketEnabled: false,
    });
    const send = (
      method: "GET" | "POST" | "PATCH" | "DELETE",
      path: string,
      payload?: object,
      actor: Actor = "owner",
    ) =>
      app.inject({
        method,
        url: "/api/v1" + path,
        payload,
        headers: {
          authorization: "Bearer " + actor,
          "Idempotency-Key": randomUUID(),
        },
      });
    const read = async <T>(response: ReturnType<typeof send>, status = 200) => {
      const result = await response;
      expect(result.statusCode, result.body).toBe(status);
      return result.json<T>();
    };
    type Scope = { organizationId: string; storeId: string };
    const path = ({ organizationId, storeId }: Scope) =>
      `/organizations/${organizationId}/stores/${storeId}`;
    const onboard = async (actor: Actor): Promise<Scope> => {
      const { organizationId, storeId } = await read<Scope>(
        send(
          "POST",
          "/onboarding",
          {
            organizationName: "Jewelry set test",
            storeName: "Main store",
            defaultCurrency: "AZN",
            fullName: "Test Owner",
          },
          actor,
        ),
      );
      return { organizationId, storeId };
    };

    try {
      const scope = await onboard("owner");
      const { organizationId } = scope;
      const other = await onboard("outsider");
      const branch = await db.store.create({
        data: { organizationId, name: "Branch" },
      });
      const branchScope = { organizationId, storeId: branch.id };
      await db.storeAssignment.create({
        data: { ...branchScope, userId: owner.userId },
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
      const store = path(scope);
      const sets = store + "/jewelry-sets";
      expect(
        (await send("POST", store + "/salesperson-mode", undefined, "display"))
          .statusCode,
      ).toBe(204);
      const categories = await db.productCategory.findMany({
        where: {
          organizationId: { in: [organizationId, other.organizationId] },
          code: "RING",
        },
      });
      const productInput = (
        scope: Scope,
        code: string,
        currency: string,
        netGoldWeight?: string,
      ) => ({
        code,
        name: code + " piece",
        categoryId: categories.find(
          (category) => category.organizationId === scope.organizationId,
        )!.id,
        purity: 585,
        weight: "1.000",
        netGoldWeight,
        acquisitionCostPerGram: { amount: "10.1234", currency },
      });
      const createProduct = (
        scope: Scope,
        code: string,
        currency = "AZN",
        netGoldWeight?: string,
        actor?: Actor,
      ) =>
        read<ProductDetail>(
          send(
            "POST",
            "/products?" + new URLSearchParams(scope),
            productInput(scope, code, currency, netGoldWeight),
            actor,
          ),
          201,
        );
      const supplier = await db.supplier.create({
        data: { ...scope, name: "Set test supplier" },
      });
      const {
        productIds: [purchased],
      } = await read<ProductRegistrationReceipt>(
        send("POST", "/products/registration?" + new URLSearchParams(scope), {
          source: "SUPPLIER_PURCHASE",
          purchase: {
            supplierId: supplier.id,
            purchaseDate: "2026-11-20",
            currency: "AZN",
          },
          products: [
            {
              ...productInput(scope, "Purchased", "AZN", "0.900"),
              acquisitionCostPerGram: undefined,
              acquisitionCost: { amount: "100.005", currency: "AZN" },
              acquisitionBreakdown: { metal: "100.005" },
            },
          ],
          initialPayment: { amount: "20", currency: "AZN", method: "CASH" },
        }),
        201,
      );
      const azn = await createProduct(scope, "Gold ring", "AZN", "0.800");
      const usd = await createProduct(scope, "Gold bracelet", "USD", "0.700");
      const missingNet = await createProduct(scope, "Legacy weight");
      const branchProduct = await createProduct(branchScope, "Branch ring");
      const outsiderProduct = await createProduct(
        other,
        "Other org ring",
        "AZN",
        undefined,
        "outsider",
      );
      const supplierPath = store + "/suppliers/" + supplier.id;
      const ledger = () => read<SupplierOverview>(send("GET", supplierPath));
      const purchaseHistory = () =>
        db.purchase.findMany({
          where: scope,
          include: { items: true, payments: true },
        });
      const productHistory = () =>
        db.product.findMany({
          where: scope,
          orderBy: { code: "asc" },
          include: { movements: { orderBy: { id: "asc" } } },
        });
      const before = await productHistory();
      const purchaseBefore = await purchaseHistory();
      const ledgerBefore = await ledger();
      const activityBefore = await db.supplierActivity.findMany({
        where: scope,
        orderBy: { id: "asc" },
      });
      const input = {
        name: "Gold ensemble",
        description: "Three pieces",
        productIds: [purchased, azn.id, usd.id],
      };
      const eligible = async () =>
        (
          await read<ProductList>(
            send(
              "GET",
              "/products?" +
                new URLSearchParams({ ...scope, setEligible: "true" }),
            ),
          )
        ).items.map(({ id }) => id);
      expect(await eligible()).toEqual(
        expect.arrayContaining(input.productIds),
      );
      for (const actor of ["staff", "display", "outsider"] as const) {
        expect((await send("POST", sets, input, actor)).statusCode).toBe(403);
        expect(
          (await send("POST", sets + "/preview", input, actor)).statusCode,
        ).toBe(403);
      }
      for (const productIds of [[], [azn.id, azn.id.toUpperCase()]]) {
        expect(
          await read(send("POST", sets, { ...input, productIds }), 400),
        ).toMatchObject({ code: "INVALID_JEWELRY_SET", field: "productIds" });
      }
      for (const foreign of [branchProduct, outsiderProduct]) {
        expect(
          await read(
            send("POST", sets, { ...input, productIds: [azn.id, foreign.id] }),
            409,
          ),
        ).toMatchObject({ code: "JEWELRY_SET_PRODUCT_UNAVAILABLE" });
        expect(
          (await send("POST", sets + "/preview", { productIds: [foreign.id] }))
            .statusCode,
        ).toBe(409);
      }
      expect(await db.jewelrySet.count({ where: scope })).toBe(0);
      const preview = await read<JewelrySetPreview>(
        send("POST", sets + "/preview", input),
      );
      expect(preview.totals).toEqual({
        itemCount: 3,
        unavailableCount: 0,
        grossWeight: "3.000",
        netGoldWeight: "2.400",
        acquisitionValues: [
          { amount: "110.1284", currency: "AZN" },
          { amount: "10.1234", currency: "USD" },
        ],
      });
      const created = await read<JewelrySetDetail>(
        send("POST", sets, input),
        201,
      );
      expect(created).toMatchObject(preview);
      expect(created.products.find(({ id }) => id === purchased)).toMatchObject(
        { acquisitionBreakdown: { metal: "100.005" }, status: "IN_STOCK" },
      );
      const set = sets + "/" + created.id;
      const updatePath = (revision: number) => set + "?revision=" + revision;
      expect(await read(send("GET", set))).toEqual(created);
      expect(
        (await send("GET", path(branchScope) + "/jewelry-sets/" + created.id))
          .statusCode,
      ).toBe(404);
      expect(
        (
          await send(
            "GET",
            path(other) + "/jewelry-sets/" + created.id,
            undefined,
            "outsider",
          )
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await read<JewelrySetList>(
            send("GET", path(branchScope) + "/jewelry-sets"),
          )
        ).items,
      ).toEqual([]);
      expect(
        (
          await read<JewelrySetList>(
            send("GET", sets + "?q=bracelet&availability=available&limit=10"),
          )
        ).items[0]?.id,
      ).toBe(created.id);
      expect(
        (await read<JewelrySetList>(send("GET", sets + "?after=" + created.id)))
          .items,
      ).toEqual([]);
      expect(await eligible()).toEqual([missingNet.id]);
      const staffView = await read<JewelrySetDetail>(
        send("GET", set, undefined, "staff"),
      );
      expect(
        staffView.products.find(({ id }) => id === purchased),
      ).not.toHaveProperty("acquisitionCost");
      expect(
        staffView.products.find(({ id }) => id === azn.id)?.acquisitionCost,
      ).toEqual(azn.acquisitionCost);
      expect(staffView.totals).not.toHaveProperty("acquisitionValues");
      const displayView = await read<JewelrySetDetail>(
        send("GET", set, undefined, "display"),
      );
      expect(
        displayView.products.every((product) => !product.acquisitionCost),
      ).toBe(true);
      expect(displayView.totals).not.toHaveProperty("acquisitionValues");
      expect(
        (await send("PATCH", updatePath(created.revision), input, "staff"))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await send(
            "DELETE",
            updatePath(created.revision),
            undefined,
            "display",
          )
        ).statusCode,
      ).toBe(403);
      expect(
        await read(send("POST", sets, { ...input, productIds: [azn.id] }), 409),
      ).toMatchObject({ code: "JEWELRY_SET_PRODUCT_CONFLICT" });
      await expect(
        db.jewelrySetMember.create({
          data: { ...scope, setId: created.id, productId: azn.id },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      await expect(
        db.jewelrySetMember.create({
          data: { ...scope, setId: created.id, productId: branchProduct.id },
        }),
      ).rejects.toMatchObject({ code: "P2003" });

      const mixed = await read<JewelrySetDetail>(
        send("PATCH", updatePath(created.revision), {
          ...input,
          name: "Updated ensemble",
          productIds: [purchased, azn.id, missingNet.id],
        }),
      );
      expect(mixed.totals).not.toHaveProperty("netGoldWeight");
      expect(mixed.totals.acquisitionValues).toEqual([
        { amount: "120.2518", currency: "AZN" },
      ]);
      expect(await eligible()).toEqual([usd.id]);
      expect(
        await read(send("PATCH", updatePath(created.revision), input), 409),
      ).toMatchObject({ code: "JEWELRY_SET_CHANGED" });
      expect(
        (await send("DELETE", updatePath(created.revision))).statusCode,
      ).toBe(409);
      const competing = await Promise.all([
        send("POST", sets, { name: "First claim", productIds: [usd.id] }),
        send("POST", sets, { name: "Second claim", productIds: [usd.id] }),
      ]);
      expect(competing.map(({ statusCode }) => statusCode).sort()).toEqual([
        201, 409,
      ]);
      const winner = competing
        .find(({ statusCode }) => statusCode === 201)!
        .json<JewelrySetDetail>();
      expect(
        await read(send("PATCH", updatePath(mixed.revision), input), 409),
      ).toMatchObject({ code: "JEWELRY_SET_PRODUCT_CONFLICT" });
      expect(await read(send("GET", set))).toEqual(mixed);
      expect(
        (
          await send(
            "DELETE",
            sets + "/" + winner.id + "?revision=" + winner.revision,
          )
        ).statusCode,
      ).toBe(204);
      expect(await productHistory()).toEqual(before);
      expect(await purchaseHistory()).toEqual(purchaseBefore);
      expect(await ledger()).toEqual(ledgerBefore);

      const sale = await send("POST", "/sales?" + new URLSearchParams(scope), {
        productId: purchased,
        expectedCurrency: "AZN",
        saleAmount: "200",
        payment: { currency: "AZN", amount: "200" },
      });
      expect(sale.statusCode, sale.body).toBe(201);
      const partlyAvailable = await read<JewelrySetDetail>(send("GET", set));
      expect(partlyAvailable.totals.unavailableCount).toBe(1);
      expect(
        partlyAvailable.products.find(({ id }) => id === purchased)?.status,
      ).toBe("SOLD");
      expect(
        (
          await read<JewelrySetList>(
            send("GET", sets + "?availability=unavailable"),
          )
        ).items[0]?.id,
      ).toBe(created.id);
      expect(
        (
          await read<JewelrySetList>(
            send("GET", sets + "?availability=available"),
          )
        ).items,
      ).toEqual([]);
      const edited = await read<JewelrySetDetail>(
        send("PATCH", updatePath(mixed.revision), input),
      );
      expect(edited.totals.unavailableCount).toBe(1);
      expect(edited.totals.acquisitionValues).toEqual(
        preview.totals.acquisitionValues,
      );
      const afterSale = await productHistory();
      expect(
        (await send("DELETE", updatePath(edited.revision))).statusCode,
      ).toBe(204);
      expect((await send("GET", set)).statusCode).toBe(404);
      expect(await db.jewelrySetMember.count({ where: scope })).toBe(0);
      expect(await eligible()).not.toContain(purchased);
      expect(
        await read(
          send("POST", sets, { ...input, productIds: [purchased] }),
          409,
        ),
      ).toMatchObject({ code: "JEWELRY_SET_PRODUCT_UNAVAILABLE" });
      expect(await productHistory()).toEqual(afterSale);
      expect(await purchaseHistory()).toEqual(purchaseBefore);
      expect(await ledger()).toEqual(ledgerBefore);
      expect(
        await db.supplierActivity.findMany({
          where: scope,
          orderBy: { id: "asc" },
        }),
      ).toEqual(activityBefore);
      expect(await db.sale.count({ where: scope })).toBe(1);
    } finally {
      await app.close();
      await db.$disconnect();
    }
  },
  15_000,
);
