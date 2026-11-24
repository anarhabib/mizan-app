import { randomUUID } from "node:crypto";
import type {
  ProductCategory,
  ProductDetail,
  SaleResult,
} from "@mizan/contracts";
import { afterAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error(
    "Profile and category tests require a disposable local database",
  );
const db = url
  ? (await import("@mizan/database")).createDatabase(url)
  : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "completes invited and legacy profiles and uses scoped categories and actor names",
  async () => {
    if (!db) throw new Error("Test database missing");
    const owner = randomUUID();
    const seller = randomUUID();
    const relay = randomUUID();
    const other = randomUUID();
    const lockedSession = randomUUID();
    let token = "";
    const actors = { owner, seller, relay, other, locked: owner };
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (bearer) => {
          const userId = actors[bearer as keyof typeof actors];
          return userId
            ? {
                userId,
                ...(bearer === "locked" && { sessionId: lockedSession }),
              }
            : null;
        },
      },
      onboardingDb: db,
      memberships: {
        db,
        verifiedEmail: async (bearer) =>
          bearer === "seller"
            ? "seller@example.com"
            : bearer === "relay"
              ? "relay@privaterelay.appleid.com"
              : null,
        sendInvitation: async (_email, invitation) => {
          token = invitation;
        },
      },
      products: { db },
      settingsDb: db,
      salesDb: db,
      goldMarketEnabled: false,
    });
    const call = (
      method: "GET" | "POST" | "PATCH",
      path: string,
      payload?: object,
      actor: keyof typeof actors = "owner",
    ) =>
      app.inject({
        method,
        url: "/api/v1" + path,
        payload,
        headers: {
          authorization: "Bearer " + actor,
          "idempotency-key": "task21-fixture",
        },
      });
    const onboarding = {
      fullName: "Leyla Əliyeva",
      organizationName: "Profiles and categories",
      storeName: "Main",
      defaultCurrency: "AZN",
    };
    try {
      const workspaces = await Promise.all([
        call("POST", "/onboarding", onboarding),
        call(
          "POST",
          "/onboarding",
          { ...onboarding, fullName: "Other Owner" },
          "other",
        ),
      ]);
      expect(workspaces.map(({ statusCode }) => statusCode)).toEqual([
        200, 200,
      ]);
      const { organizationId, storeId } = workspaces[0].json();
      const otherOrg = workspaces[1].json().organizationId;
      const scope = new URLSearchParams({ organizationId, storeId });
      const base = `/organizations/${organizationId}`;
      const categoryBase = `${base}/product-categories`;
      expect((await call("GET", "/me/profile")).json()).toEqual({
        fullName: onboarding.fullName,
        hasMembership: true,
      });
      await db.user.update({ where: { id: owner }, data: { fullName: null } });
      expect((await call("GET", "/me/profile")).json()).toEqual({
        fullName: null,
        hasMembership: true,
      });
      expect(
        (await call("PATCH", "/me/profile", { fullName: "Bad", userId: other }))
          .statusCode,
      ).toBe(400);
      expect(
        (
          await call("PATCH", "/me/profile", {
            fullName: "  Leyla Məmmədova  ",
          })
        ).json(),
      ).toMatchObject({ fullName: "Leyla Məmmədova" });
      expect((await call("GET", "/me/contexts")).json()).toMatchObject([
        { role: "OWNER", storeId },
      ]);

      expect(
        (
          await call("POST", `${base}/invitations`, {
            email: "seller@example.com",
            storeId,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (await call("POST", "/invitations/accept", { token }, "relay"))
          .statusCode,
      ).toBe(409);
      expect(
        (await call("POST", "/invitations/accept", { token }, "seller"))
          .statusCode,
      ).toBe(200);
      expect(
        (await call("GET", "/me/profile", undefined, "seller")).json(),
      ).toEqual({ fullName: null, hasMembership: true });
      expect(
        (
          await call(
            "PATCH",
            "/me/profile",
            { fullName: "Əli Həsənov" },
            "seller",
          )
        ).statusCode,
      ).toBe(200);
      expect(
        (await call("GET", "/me/contexts", undefined, "seller")).json(),
      ).toMatchObject([{ role: "SALESPERSON", storeId }]);
      expect(
        (await call("POST", "/onboarding", onboarding, "seller")).statusCode,
      ).toBe(403);
      expect((await call("GET", `${base}/memberships`)).json()).toMatchObject({
        members: [{ userId: seller, fullName: "Əli Həsənov" }],
      });

      const defaults = (await call("GET", categoryBase + "?all=1")).json<
        ProductCategory[]
      >();
      expect(defaults).toHaveLength(11);
      const ring = defaults.find(({ code }) => code === "RING")!;
      const foreign = (
        await call(
          "GET",
          `/organizations/${otherOrg}/product-categories`,
          undefined,
          "other",
        )
      ).json<ProductCategory[]>()[0];
      expect(
        (await call("GET", categoryBase, undefined, "other")).statusCode,
      ).toBe(403);
      expect(
        (await call("GET", categoryBase + "?all=1", undefined, "seller"))
          .statusCode,
      ).toBe(403);
      expect(
        (await call("POST", categoryBase, { name: "Forbidden" }, "seller"))
          .statusCode,
      ).toBe(403);
      await db.salespersonDisplaySession.create({
        data: { sessionId: lockedSession, userId: owner },
      });
      expect(
        (
          await call(
            "PATCH",
            `${categoryBase}/${ring.id}`,
            { name: "Forbidden" },
            "locked",
          )
        ).statusCode,
      ).toBe(403);
      const created = await call("POST", categoryBase, { name: "  Vintage  " });
      expect(created.statusCode).toBe(201);
      const custom = created.json<ProductCategory>();
      expect(custom).toMatchObject({
        name: "Vintage",
        code: null,
        isActive: true,
      });
      expect(
        (await call("POST", categoryBase, { name: "vINTAGE" })).json(),
      ).toMatchObject({ code: "CATEGORY_CONFLICT" });
      expect(
        (await call("PATCH", `${categoryBase}/${custom.id}`, { sortOrder: 0 }))
          .statusCode,
      ).toBe(200);
      const reordered = (await call("GET", categoryBase)).json<
        ProductCategory[]
      >();
      expect(
        reordered.slice(0, 2).map(({ id, sortOrder }) => [id, sortOrder]),
      ).toEqual([
        [custom.id, 0],
        [ring.id, 1],
      ]);
      expect(
        (
          await call("PATCH", `${categoryBase}/${foreign.id}`, {
            isActive: false,
          })
        ).statusCode,
      ).toBe(409);

      const acquisition = {
        weight: "2",
        acquisitionCostPerGram: { amount: "10", currency: "AZN" },
      };
      const productInput = {
        code: "TASK21-1",
        name: "Ring",
        purity: 585,
        ...acquisition,
      };
      const productPath = `/products?${scope}`;
      const productCreate = (categoryId: string) =>
        call("POST", productPath, { ...productInput, categoryId }, "seller");
      expect((await productCreate(foreign.id)).json()).toMatchObject({
        code: "CATEGORY_UNAVAILABLE",
      });
      expect(
        (
          await call(
            "POST",
            productPath,
            { ...productInput, category: "Unconfigured" },
            "seller",
          )
        ).statusCode,
      ).toBe(409);
      const productResponse = await productCreate(ring.id);
      expect(productResponse.statusCode).toBe(201);
      const product = productResponse.json<ProductDetail>();
      expect(product).toMatchObject({
        productCategory: { id: ring.id },
        movements: [{ actorId: seller, actorName: "Əli Həsənov" }],
      });
      expect(
        (await call("GET", productPath + `&categoryId=${ring.id}`)).json(),
      ).toMatchObject({ items: [{ id: product.id }] });
      expect(
        (await call("GET", productPath + `&categoryId=${foreign.id}`)).json(),
      ).toMatchObject({ items: [] });
      expect(
        (await call("PATCH", `${categoryBase}/${ring.id}`, { isActive: false }))
          .statusCode,
      ).toBe(200);
      expect(
        (await call("GET", categoryBase, undefined, "seller"))
          .json<ProductCategory[]>()
          .some(({ id }) => id === ring.id),
      ).toBe(false);
      expect((await productCreate(ring.id)).json()).toMatchObject({
        code: "CATEGORY_UNAVAILABLE",
      });
      expect(
        (await call("PATCH", `${categoryBase}/${ring.id}`, { isActive: true }))
          .statusCode,
      ).toBe(200);
      expect(
        (
          await call("PATCH", `/products/${product.id}/acquisition?${scope}`, {
            ...acquisition,
            categoryId: custom.id,
          })
        ).statusCode,
      ).toBe(204);
      expect(
        (
          await call("PATCH", `${categoryBase}/${custom.id}`, {
            name: "Antique",
          })
        ).statusCode,
      ).toBe(200);
      const detailPath = `/products/${product.id}?${scope}`;
      expect((await call("GET", detailPath)).json()).toMatchObject({
        category: "Antique",
        productCategory: { id: custom.id },
      });
      const sold = await call(
        "POST",
        `/sales?${scope}`,
        { productId: product.id, saleAmount: "50" },
        "seller",
      );
      expect(sold.statusCode).toBe(201);
      const sale = sold.json<SaleResult>();
      expect(sale).toMatchObject({
        actorId: seller,
        actorName: "Əli Həsənov",
        product: { category: "Antique" },
        payments: [{ actorName: "Əli Həsənov" }],
      });
      expect(
        (
          await call("PATCH", `${categoryBase}/${custom.id}`, {
            name: "Modern",
            isActive: false,
          })
        ).statusCode,
      ).toBe(200);
      expect((await call("GET", detailPath)).json()).toMatchObject({
        category: "Modern",
        productCategory: { isActive: false },
      });
      expect(
        (await call("GET", `/sales/${sale.id}?${scope}`)).json(),
      ).toMatchObject({
        product: { category: "Antique" },
        actorName: "Əli Həsənov",
      });
      const activity = await call(
        "GET",
        `${base}/stores/${storeId}/dashboard/activity`,
      );
      expect(activity.statusCode).toBe(200);
      expect(activity.json().items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "intake",
            recordId: product.id,
            actorName: "Əli Həsənov",
          }),
          expect.objectContaining({
            kind: "sale",
            recordId: sale.id,
            actorName: "Əli Həsənov",
          }),
        ]),
      );
    } finally {
      await app.close();
    }
  },
  30_000,
);
