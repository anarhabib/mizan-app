import { randomUUID } from "node:crypto";
import type { MembershipDirectory } from "@mizan/contracts";
import { afterAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (
  url &&
  !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)
) {
  throw new Error("Membership tests require a disposable local database");
}
const db = url
  ? (await import("@mizan/database")).createDatabase(url)
  : undefined;
afterAll(async () => db?.$disconnect());

test.skipIf(!db)(
  "applies current owner authorization, single-use invites and reversible salesperson access",
  async () => {
    if (!db) throw new Error("Test database missing");
    const owner = randomUUID();
    const salesperson = randomUUID();
    const outsider = randomUUID();
    const emails = new Map([
      ["seller", "seller@example.com"],
      ["outsider", "other@example.com"],
    ]);
    const deliveries: { email: string; token: string }[] = [];
    const organizations = await Promise.all(
      ["Owner", "Other"].map((name) =>
        db.organization.create({
          data: {
            name,
            defaultCurrency: "AZN",
            stores: { create: [{ name: "First" }, { name: "Second" }] },
          },
          include: { stores: true },
        }),
      ),
    );
    const [org, other] = organizations;
    const [store, second] = org.stores;
    await db.user.createMany({
      data: [owner, salesperson, outsider].map((id) => ({ id })),
    });
    await db.organizationMembership.create({
      data: { organizationId: org.id, userId: owner, role: "OWNER" },
    });
    await db.storeAssignment.create({
      data: { organizationId: org.id, storeId: store.id, userId: owner },
    });
    await db.organizationMembership.create({
      data: { organizationId: other.id, userId: salesperson, role: "OWNER" },
    });
    let failDelivery = false;
    const principals: Record<string, string> = {
      owner,
      seller: salesperson,
      outsider,
    };
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) => {
          const userId = principals[token];
          return userId ? { userId } : null;
        },
      },
      onboardingDb: db,
      memberships: {
        db,
        verifiedEmail: async (bearer: string) => emails.get(bearer) ?? null,
        sendInvitation: async (email: string, token: string) => {
          if (failDelivery) throw new Error("SMTP unavailable");
          deliveries.push({ email, token });
        },
      },
    });
    const base = `/api/v1/organizations/${org.id}`;
    const request = (
      method: "POST" | "GET",
      url: string,
      token: string,
      payload?: object,
    ) =>
      app.inject({
        method,
        url,
        headers: { authorization: `Bearer ${token}` },
        payload,
      });
    const invite = (email: string, storeId = store.id, token = "owner") =>
      request("POST", `${base}/invitations`, token, { email, storeId });
    const accept = (token: string, user = "seller") =>
      request("POST", "/api/v1/invitations/accept", user, { token });
    const action = (suffix: string, payload?: object) =>
      request("POST", `${base}/${suffix}`, "owner", payload);
    const access = () =>
      request("GET", `${base}/stores/${store.id}/access`, "seller");
    try {
      expect(
        (await invite("seller@example.com", store.id, "seller")).statusCode,
      ).toBe(403);
      expect(
        (await invite("seller@example.com", other.stores[0].id)).statusCode,
      ).toBe(403);
      failDelivery = true;
      const failed = await invite("retry@example.com");
      expect(failed.json()).toMatchObject({
        delivery: "failed",
        status: "pending",
      });
      failDelivery = false;
      const failedId = failed.json().id;
      expect(
        (await action(`invitations/${failedId}/resend`)).json(),
      ).toMatchObject({ delivery: "sent" });
      expect((await action(`invitations/${failedId}/revoke`)).statusCode).toBe(
        200,
      );
      expect((await accept(deliveries.at(-1)!.token)).statusCode).toBe(409);
      expect((await action(`invitations/${failedId}/resend`)).statusCode).toBe(
        409,
      );

      const created = await invite("SELLER@example.com");
      expect(created.statusCode).toBe(200);
      const id = created.json().id;
      const oldToken = deliveries.at(-1)!.token;
      expect(created.body).not.toContain(oldToken);
      expect((await invite("seller@example.com")).json()).toMatchObject({
        id,
        delivery: "not_sent",
      });
      await db.invitation.update({
        where: { id },
        data: { expiresAt: new Date(0) },
      });
      expect((await accept(oldToken)).statusCode).toBe(409);
      expect((await action(`invitations/${id}/resend`)).statusCode).toBe(200);
      const token = deliveries.at(-1)!.token;
      expect(token).not.toBe(oldToken);
      expect((await accept(oldToken)).statusCode).toBe(409);
      expect((await accept(token, "outsider")).statusCode).toBe(409);
      const attempts = await Promise.all([accept(token), accept(token)]);
      expect(attempts.map((reply) => reply.statusCode).sort()).toEqual([
        200, 409,
      ]);
      expect((await access()).statusCode).toBe(200);
      expect(
        await db.organizationMembership.count({
          where: { userId: salesperson },
        }),
      ).toBe(2);

      expect(
        (await action(`members/${salesperson}/deactivate`)).statusCode,
      ).toBe(200);
      expect((await access()).statusCode).toBe(403);
      expect(
        (await action(`members/${salesperson}/reactivate`)).statusCode,
      ).toBe(200);
      expect((await access()).statusCode).toBe(200);
      expect(
        (await action(`members/${salesperson}/stores/${second.id}/assign`))
          .statusCode,
      ).toBe(200);
      expect(
        (
          await action(
            `members/${salesperson}/stores/${other.stores[0].id}/assign`,
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (await action(`members/${salesperson}/stores/${store.id}/remove`))
          .statusCode,
      ).toBe(200);
      expect((await access()).statusCode).toBe(403);
      const listed = await request("GET", `${base}/memberships`, "owner");
      expect(listed.json()).toMatchObject({
        invitations: expect.arrayContaining([
          expect.objectContaining({ id, status: "accepted" }),
        ]),
        members: [
          expect.objectContaining({
            userId: salesperson,
            status: "active",
            email: "seller@example.com",
          }),
        ],
      });
      expect(
        (await request("GET", `${base}/memberships`, "seller")).statusCode,
      ).toBe(403);
      const extraMembers = Array.from({ length: 11 }, () => randomUUID());
      await db.user.createMany({ data: extraMembers.map((id) => ({ id })) });
      await db.organizationMembership.createMany({
        data: extraMembers.map((userId) => ({
          organizationId: org.id,
          userId,
          role: "SALESPERSON",
        })),
      });
      await db.invitation.createMany({
        data: Array.from({ length: 12 }, (_, index) => ({
          organizationId: org.id,
          storeId: store.id,
          invitedById: owner,
          email: `page-${index}@example.com`,
          tokenDigest: randomUUID(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          expiresAt: new Date("2099-01-01T00:00:00Z"),
        })),
      });
      const pagePath = `${base}/memberships?memberLimit=10&invitationLimit=10&pendingInvitations=true`;
      const firstPage = await request("GET", pagePath, "owner");
      expect(firstPage.statusCode, firstPage.body).toBe(200);
      const first = firstPage.json<MembershipDirectory>();
      expect(first.members).toHaveLength(10);
      expect(first.invitations).toHaveLength(10);
      const nextPage = await request(
        "GET",
        `${pagePath}&memberAfter=${first.nextMemberCursor}&invitationAfter=${first.nextInvitationCursor}`,
        "owner",
      );
      expect(nextPage.statusCode, nextPage.body).toBe(200);
      const next = nextPage.json<MembershipDirectory>();
      expect(next.members).toHaveLength(2);
      expect(next.invitations).toHaveLength(2);
      expect(
        new Set([...first.members, ...next.members].map(({ userId }) => userId))
          .size,
      ).toBe(12);
      expect(
        new Set([...first.invitations, ...next.invitations].map(({ id }) => id))
          .size,
      ).toBe(12);
      expect(next).not.toHaveProperty("nextMemberCursor");
      expect(next).not.toHaveProperty("nextInvitationCursor");
    } finally {
      await app.close();
    }
  },
  25_000,
);
