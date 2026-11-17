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
  "only owners can edit their settings and rates remain available after grade deactivation",
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
        rates: [],
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
      const rate = (amountPerGram: unknown, currency = "USD", purity = 610) =>
        update("rates", { purity, currency, amountPerGram });
      for (const invalid of ["0", "-2", "1.00001", "100000000000000.00", 20])
        expect((await rate(invalid)).statusCode).toBe(400);
      expect((await rate("1", "ZZZ")).statusCode).toBe(400);
      expect((await rate("1", "USD", 611)).statusCode).toBe(409);
      expect((await rate("32.7901")).statusCode).toBe(200);
      expect((await rate("35.1000")).statusCode).toBe(200);
      expect((await rate("58.11", "AZN")).statusCode).toBe(200);
      const activeRates = (await directory()).json().rates;
      expect(activeRates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            currency: "USD",
            amountPerGram: "32.7901",
            current: false,
          }),
          expect.objectContaining({
            currency: "USD",
            amountPerGram: "35.1000",
            current: true,
          }),
          expect.objectContaining({
            currency: "AZN",
            amountPerGram: "58.1100",
            current: true,
          }),
        ]),
      );
      expect(activeRates).toHaveLength(3);
      expect((await update("purities/610/deactivate", {})).statusCode).toBe(
        200,
      );
      expect((await rate("36")).statusCode).toBe(409);
      const historical = (await directory()).json();
      expect(historical.purities).toContainEqual({ value: 610, active: false });
      expect(historical.rates).toEqual(
        activeRates.map((entry: object) => ({ ...entry, current: false })),
      );
    } finally {
      await app.close();
    }
  },
  25_000,
);
