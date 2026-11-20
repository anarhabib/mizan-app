import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url
  ? (await import("@mizan/database")).createDatabase(url)
  : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "restricts an owner session across token refreshes while preserving salesperson workflows",
  async () => {
    if (!db) throw new Error("Test database missing");
    const owner = { userId: randomUUID(), sessionId: randomUUID() };
    const seller = { userId: randomUUID(), sessionId: randomUUID() };
    const otherDevice = { ...owner, sessionId: randomUUID() };
    const signedInAgain = { ...owner, sessionId: randomUUID() };
    const identities = new Map([
      ["owner", owner],
      ["refreshed-owner", owner],
      ["seller", seller],
      ["other-device", otherDevice],
      ["reauthenticated-owner", signedInAgain],
    ]);
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) => identities.get(token) ?? null,
      },
      onboardingDb: db,
      settingsDb: db,
      memberships: {
        db,
        verifiedEmail: async () => null,
        sendInvitation: async () => {},
      },
      products: { db },
      salesDb: db,
    });
    const send = (
      method: "GET" | "POST" | "PATCH" | "DELETE",
      path: string,
      token = "owner",
      payload?: object,
    ) =>
      app.inject({
        method,
        url: "/api/v1" + path,
        payload,
        headers: {
          authorization: "Bearer " + token,
          "idempotency-key": randomUUID(),
        },
      });
    try {
      const onboard = await send("POST", "/onboarding", "owner", {
        organizationName: "Display mode test",
        storeName: "Main store",
        defaultCurrency: "AZN",
      });
      expect(onboard.statusCode).toBe(200);
      const { organizationId, storeId } = onboard.json();
      const organization = `/organizations/${organizationId}`;
      const store = `${organization}/stores/${storeId}`;
      const scope = `?organizationId=${organizationId}&storeId=${storeId}`;
      await db.user.create({ data: { id: seller.userId } });
      await db.organizationMembership.create({
        data: { organizationId, userId: seller.userId, role: "SALESPERSON" },
      });
      await db.storeAssignment.create({
        data: { organizationId, storeId, userId: seller.userId },
      });
      await db.organization.update({
        where: { id: organizationId },
        data: { salespersonCanViewAcquisitionCost: true },
      });
      const intake = {
        code: "DISPLAY",
        name: "Gold ring",
        category: "Rings",
        purity: 585,
        weight: "2",
        acquisitionCostPerGram: { amount: "60", currency: "AZN" },
      };
      const created = await send("POST", "/products" + scope, "owner", intake);
      expect(created.statusCode).toBe(201);
      const { id } = created.json();
      const detail = `/products/${id}`;
      const ownerFields = [
        "acquisitionCost",
        "acquisitionCostPerGram",
        "canEditAcquisition",
        "canDelete",
      ];
      for (const field of ownerFields)
        expect(created.json()).toHaveProperty(field);
      expect(
        (await send("GET", detail + scope, "seller")).json(),
      ).toHaveProperty("acquisitionCost");
      expect(
        (await send("POST", store + "/salesperson-mode", "seller")).statusCode,
      ).toBe(403);

      for (let attempt = 0; attempt < 2; attempt++) {
        expect(
          (await send("POST", store + "/salesperson-mode")).statusCode,
        ).toBe(204);
      }
      const restrictedAccess = await send(
        "GET",
        store + "/access",
        "refreshed-owner",
      );
      expect(restrictedAccess.json()).toMatchObject({
        role: "OWNER",
        salespersonDisplay: true,
      });
      expect(restrictedAccess.json()).not.toHaveProperty("sessionId");
      for (const token of ["owner", "refreshed-owner"]) {
        const restrictedDetail = await send("GET", detail + scope, token);
        expect(restrictedDetail.statusCode).toBe(200);
        for (const field of ownerFields)
          expect(restrictedDetail.json()).not.toHaveProperty(field);
      }
      for (const token of ["other-device", "reauthenticated-owner"]) {
        expect(
          (await send("GET", detail + scope, token)).json(),
        ).toHaveProperty("acquisitionCost");
      }
      for (const [method, path] of [
        ["GET", organization + "/settings"],
        ["GET", organization + "/memberships"],
        ["POST", organization + "/settings"],
        ["POST", organization + "/invitations"],
        ["PATCH", detail + "/acquisition" + scope],
        ["DELETE", detail + scope],
      ] as const) {
        expect((await send(method, path)).statusCode).toBe(403);
      }

      const scopedIntake = await send("POST", "/products" + scope, "owner", {
        ...intake,
        code: "DISPLAY-RESTRICTED",
      });
      expect(scopedIntake.statusCode).toBe(201);
      for (const field of ownerFields)
        expect(scopedIntake.json()).not.toHaveProperty(field);
      const sale = await send("POST", "/sales" + scope, "owner", {
        productId: id,
        saleAmount: "150",
        expectedCurrency: "AZN",
      });
      expect(sale.statusCode).toBe(201);
      expect(
        (await send("GET", `/sales/${sale.json().id}` + scope)).statusCode,
      ).toBe(200);
      expect((await send("GET", "/sales" + scope)).statusCode).toBe(200);
      expect(
        (await send("GET", "/products" + scope + "&q=DISPLAY")).statusCode,
      ).toBe(200);
    } finally {
      await app.close();
    }
  },
);
