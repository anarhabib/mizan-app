import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
const databaseUrl = url ? new URL(url) : undefined;
if (
  databaseUrl &&
  !["127.0.0.1", "localhost", "[::1]"].includes(databaseUrl.hostname)
) {
  throw new Error("Access tests require a loopback test database");
}
const db = url
  ? (await import("@mizan/database")).createDatabase(url)
  : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "checks current membership and assignment on every scoped request",
  async () => {
    if (!db) throw new Error("Missing test database");
    const rollback = new Error("Roll back access test fixtures");

    await expect(
      db.$transaction(
        async (tx) => {
          const userId = randomUUID();
          const outsiderId = randomUUID();
          const contexts = [];
          for (const role of ["OWNER", "SALESPERSON"] as const) {
            const organization = await tx.organization.create({
              data: {
                name: "Test business",
                defaultCurrency: "AZN",
                salespersonCanViewAcquisitionCost: role === "OWNER",
              },
            });
            const store = await tx.store.create({
              data: { organizationId: organization.id, name: "Test store" },
            });
            contexts.push({
              organizationId: organization.id,
              storeId: store.id,
              role,
            });
          }
          const [first, second] = contexts;
          const app = await buildApp({
            access: {
              db: tx,
              verifyToken: async (token) =>
                token === "valid"
                  ? { userId }
                  : token === "outsider"
                    ? { userId: outsiderId }
                    : null,
            },
          });
          const url = (organizationId: string, storeId: string) =>
            `/api/v1/organizations/${organizationId}/stores/${storeId}/access`;
          const request = (path: string, token?: string) =>
            app.inject({
              method: "GET",
              url: path,
              headers: token ? { authorization: `Bearer ${token}` } : {},
            });
          const firstPath = url(first.organizationId, first.storeId);
          const secondPath = url(second.organizationId, second.storeId);

          try {
            expect((await request(firstPath)).statusCode).toBe(401);
            expect((await request(firstPath, "invalid")).statusCode).toBe(401);
            expect(await tx.user.count({ where: { id: userId } })).toBe(0);
            expect((await request(firstPath, "valid")).statusCode).toBe(403);
            expect((await request(firstPath, "valid")).statusCode).toBe(403);
            expect(await tx.user.count({ where: { id: userId } })).toBe(1);

            for (const { organizationId, storeId, role } of contexts) {
              await tx.organizationMembership.create({
                data: { organizationId, userId, role },
              });
              await tx.storeAssignment.create({
                data: { organizationId, storeId, userId },
              });
            }
            const firstResponse = await request(firstPath, "valid");
            expect(firstResponse.statusCode).toBe(200);
            expect(firstResponse.json()).toEqual({
              ...first,
              userId,
              settings: {
                defaultCurrency: "AZN",
                salespersonCanViewAcquisitionCost: true,
              },
            });
            expect((await request(secondPath, "valid")).json()).toEqual({
              ...second,
              userId,
              settings: {
                defaultCurrency: "AZN",
                salespersonCanViewAcquisitionCost: false,
              },
            });

            const missing = await request(
              url(first.organizationId, randomUUID()),
              "valid",
            );
            expect(missing.statusCode).toBe(403);
            for (const path of [
              url(first.organizationId, second.storeId),
              url(randomUUID(), first.storeId),
            ]) {
              const denied = await request(path, "valid");
              expect(denied.statusCode).toBe(403);
              expect(denied.json()).toEqual(missing.json());
            }
            const denied = await request(firstPath, "outsider");
            expect(denied.statusCode).toBe(403);
            expect(denied.json()).toEqual(missing.json());

            await tx.storeAssignment.update({
              where: {
                organizationId_storeId_userId: {
                  organizationId: first.organizationId,
                  storeId: first.storeId,
                  userId,
                },
              },
              data: { active: false },
            });
            expect((await request(firstPath, "valid")).statusCode).toBe(403);
            expect((await request(secondPath, "valid")).statusCode).toBe(200);
            await tx.organizationMembership.update({
              where: {
                organizationId_userId: {
                  organizationId: second.organizationId,
                  userId,
                },
              },
              data: { active: false },
            });
            expect((await request(secondPath, "valid")).statusCode).toBe(403);
          } finally {
            await app.close();
          }
          throw rollback;
        },
        { timeout: 15_000 },
      ),
    ).rejects.toBe(rollback);
  },
  20_000,
);
