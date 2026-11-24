import { randomUUID } from "node:crypto";
import { defaultCategoryLabels } from "@mizan/contracts";
import { afterAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (
  url &&
  !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)
) {
  throw new Error("Onboarding tests require a local test database");
}
const db = url
  ? (await import("@mizan/database")).createDatabase(url)
  : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "retries interrupted setup and creates one workspace even with concurrent requests",
  async () => {
    if (!db) throw new Error("Test database missing");
    const userId = randomUUID();
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) => (token === "owner" ? { userId } : null),
      },
      onboardingDb: db,
    });
    const headers = { authorization: "Bearer owner" };
    const payload = {
      fullName: "  Əli Məmmədov  ",
      organizationName: "  Mizan Test  ",
      storeName: "Bakı",
      defaultCurrency: "AZN",
    };
    const post = (body = payload) =>
      app.inject({
        method: "POST",
        url: "/api/v1/onboarding",
        headers,
        payload: body,
      });
    const contexts = () =>
      app.inject({ method: "GET", url: "/api/v1/me/contexts", headers });
    try {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/onboarding",
            payload,
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (await post({ ...payload, defaultCurrency: "ZZZ" })).statusCode,
      ).toBe(400);
      expect((await post({ ...payload, fullName: "" })).statusCode).toBe(400);
      expect((await contexts()).json()).toEqual([]);
      expect(await db.user.count({ where: { id: userId } })).toBe(1);

      const responses = await Promise.all([post(), post(), post()]);
      expect(responses.map((response) => response.statusCode)).toEqual([
        200, 200, 200,
      ]);
      const result = responses[0].json();
      expect(result).toMatchObject({
        organizationId: expect.any(String),
        storeId: expect.any(String),
        membershipId: expect.any(String),
      });
      expect(responses.map((response) => response.json())).toEqual([
        result,
        result,
        result,
      ]);
      expect(
        (
          await post({
            ...payload,
            fullName: "Ignored retry name",
            organizationName: "Ignored retry values",
          })
        ).json(),
      ).toEqual(result);
      expect(await db.user.findUnique({ where: { id: userId } })).toMatchObject(
        { fullName: "Əli Məmmədov" },
      );
      expect(
        await db.productCategory.findMany({
          where: { organizationId: result.organizationId },
          orderBy: { sortOrder: "asc" },
          select: { code: true, name: true, isActive: true },
        }),
      ).toEqual(
        Object.entries(defaultCategoryLabels).map(([code, { az: name }]) => ({
          code,
          name,
          isActive: true,
        })),
      );
      const memberships = await db.organizationMembership.findMany({
        where: { userId },
        include: {
          organization: {
            include: { stores: true, purities: { orderBy: { value: "asc" } } },
          },
        },
      });
      expect(memberships).toHaveLength(1);
      expect(memberships[0].organization).toMatchObject({
        id: result.organizationId,
        name: "Mizan Test",
        defaultCurrency: "AZN",
        salespersonCanViewAcquisitionCost: false,
        stores: [{ id: result.storeId, name: "Bakı" }],
        purities: [375, 585, 750, 916, 999].map((value) => ({
          value,
          active: true,
        })),
      });
      expect((await contexts()).json()).toEqual([
        {
          organizationId: result.organizationId,
          organizationName: "Mizan Test",
          storeId: result.storeId,
          storeName: "Bakı",
          role: "OWNER",
        },
      ]);
      await db.storeAssignment.update({
        where: {
          organizationId_storeId_userId: {
            organizationId: result.organizationId,
            storeId: result.storeId,
            userId,
          },
        },
        data: { active: false },
      });
      expect((await contexts()).json()).toEqual([]);
      expect((await post()).statusCode).toBe(403);
    } finally {
      await app.close();
    }
  },
  20_000,
);
