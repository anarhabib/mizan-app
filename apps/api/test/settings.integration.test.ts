import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local settings database");
const db = url
  ? (await import("@mizan/database")).createDatabase(url)
  : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "only owners can edit trading settings and manage purity activation",
  async () => {
    if (!db) throw new Error("Test database missing");
    const identities: Record<string, string> = {
      owner: randomUUID(),
      seller: randomUUID(),
      other: randomUUID(),
    };
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) =>
          identities[token] ? { userId: identities[token] } : null,
      },
      onboardingDb: db,
      settingsDb: db,
    });
    const send = (
      method: "GET" | "POST",
      url: string,
      account: string,
      payload?: object,
    ) =>
      app.inject({
        method,
        url,
        headers: { authorization: `Bearer ${account}` },
        payload,
      });
    const onboard = (name: string, account: string) =>
      send("POST", "/api/v1/onboarding", account, {
        fullName: "Settings Test Owner",
        organizationName: name,
        storeName: "Test store",
        defaultCurrency: "USD",
      });
    try {
      const { organizationId, storeId } = (
        await onboard("Settings fixture", "owner")
      ).json();
      const { organizationId: otherId } = (
        await onboard("Other fixture", "other")
      ).json();
      const base = `/api/v1/organizations/${organizationId}`;
      const update = (suffix: string, payload: object, user = "owner") =>
        send("POST", `${base}/${suffix}`, user, payload);
      const directory = () => send("GET", `${base}/settings`, "owner");
      await db.user.create({ data: { id: identities.seller } });
      await db.organizationMembership.create({
        data: {
          organizationId,
          userId: identities.seller,
          role: "SALESPERSON",
        },
      });
      await db.storeAssignment.create({
        data: { organizationId, storeId, userId: identities.seller },
      });

      const initial = await directory();
      expect(initial.statusCode).toBe(200);
      expect(initial.json()).toMatchObject({
        settings: {
          defaultCurrency: "USD",
          salespersonCanViewAcquisitionCost: false,
        },
        purities: [375, 585, 750, 916, 999].map((value) => ({
          value,
          active: true,
        })),
      });
      expect((await send("GET", `${base}/settings`, "seller")).statusCode).toBe(
        403,
      );
      expect(
        (
          await send(
            "GET",
            `/api/v1/organizations/${otherId}/settings`,
            "owner",
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await update(
            "settings",
            { salespersonCanViewAcquisitionCost: true },
            "seller",
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await update("settings", {
            salespersonCanViewAcquisitionCost: "true",
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await update("settings", {
            salespersonCanViewAcquisitionCost: true,
            defaultCurrency: "AZN",
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await update("settings", { salespersonCanViewAcquisitionCost: true }))
          .statusCode,
      ).toBe(200);
      const access = () =>
        send("GET", `${base}/stores/${storeId}/access`, "seller");
      expect(
        (await access()).json().settings.salespersonCanViewAcquisitionCost,
      ).toBe(true);
      expect(
        (await update("settings", { salespersonCanViewAcquisitionCost: false }))
          .statusCode,
      ).toBe(200);
      expect(
        (await access()).json().settings.salespersonCanViewAcquisitionCost,
      ).toBe(false);

      expect((await update("purities", { value: 1001 })).statusCode).toBe(400);
      expect((await update("purities", { value: 610 })).statusCode).toBe(200);
      expect((await update("purities", { value: 610 })).statusCode).toBe(409);
      expect((await update("purities/610/deactivate", {})).statusCode).toBe(
        200,
      );
      const historical = (await directory()).json();
      expect(historical.purities).toContainEqual({ value: 610, active: false });
      expect(
        (await update("purities/610/reactivate", {}, "seller")).statusCode,
      ).toBe(403);
      expect((await update("purities/611/reactivate", {})).statusCode).toBe(
        409,
      );
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await update("purities/610/reactivate", {});
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ value: 610, active: true });
      }
      const restored = (await directory()).json();
      expect(restored.purities).toContainEqual({ value: 610, active: true });
    } finally {
      await app.close();
    }
  },
  25_000,
);
