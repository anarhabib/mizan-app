import { createHash, randomBytes } from "node:crypto";
import type { InvitationSummary, MembershipDirectory } from "@mizan/contracts";
import type { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import { uuidPattern } from "../access/access.service.js";

type Tx = Prisma.TransactionClient;
export type MembershipDatabase = Tx & {
  $transaction<T>(callback: (tx: Tx) => Promise<T>): Promise<T>;
};
type Invite = Pick<
  Prisma.InvitationGetPayload<object>,
  "id" | "email" | "storeId" | "expiresAt" | "revokedAt" | "acceptedAt"
>;
const tokenDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function summarize(invite: Invite): InvitationSummary {
  return {
    id: invite.id,
    email: invite.email,
    storeId: invite.storeId,
    expiresAt: invite.expiresAt.toISOString(),
    status: invite.acceptedAt
      ? "accepted"
      : invite.revokedAt
        ? "revoked"
        : invite.expiresAt <= new Date()
          ? "expired"
          : "pending",
  };
}

async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.$queryRaw`SELECT "id" FROM "mizan"."Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
}

async function assertOwner(db: Tx, organizationId: string, userId: string) {
  if (
    !uuidPattern.test(organizationId) ||
    !(await db.organizationMembership.findFirst({
      where: { organizationId, userId, active: true, role: "OWNER" },
      select: { userId: true },
    }))
  )
    throw new AccessError("ACCESS_DENIED");
}

async function assertStore(db: Tx, organizationId: string, id: string) {
  if (
    !uuidPattern.test(id) ||
    !(await db.store.findUnique({
      where: { organizationId_id: { organizationId, id } },
      select: { id: true },
    }))
  )
    throw new AccessError("ACCESS_DENIED");
}

export async function listMemberships(
  db: MembershipDatabase,
  organizationId: string,
  ownerId: string,
): Promise<MembershipDirectory> {
  await assertOwner(db, organizationId, ownerId);
  const [stores, invitations, memberships] = await Promise.all([
    db.store.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.invitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
    db.organizationMembership.findMany({
      where: { organizationId, role: "SALESPERSON" },
      orderBy: { userId: "asc" },
      select: {
        userId: true,
        active: true,
        assignments: { where: { active: true }, select: { storeId: true } },
        acceptedInvitations: {
          orderBy: { acceptedAt: "desc" },
          take: 1,
          select: { email: true },
        },
      },
    }),
  ]);
  return {
    stores,
    invitations: invitations.map(summarize),
    members: memberships.map((member) => ({
      userId: member.userId,
      status: member.active ? "active" : "inactive",
      email: member.acceptedInvitations[0]?.email ?? null,
      storeIds: member.assignments.map((assignment) => assignment.storeId),
    })),
  };
}

function ownerChange<T>(
  db: MembershipDatabase,
  organizationId: string,
  userId: string,
  work: (tx: Tx) => Promise<T>,
) {
  return db.$transaction(async (tx) => {
    if (!uuidPattern.test(organizationId))
      throw new AccessError("ACCESS_DENIED");
    await lockOrganization(tx, organizationId);
    await assertOwner(tx, organizationId, userId);
    return work(tx);
  });
}

function freshToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    fields: {
      tokenDigest: tokenDigest(token),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  };
}

export function createInvitation(
  db: MembershipDatabase,
  organizationId: string,
  ownerId: string,
  storeId: string,
  email: string,
) {
  return ownerChange(db, organizationId, ownerId, async (tx) => {
    await assertStore(tx, organizationId, storeId);
    const pending = await tx.invitation.findFirst({
      where: {
        organizationId,
        storeId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (pending) return { summary: summarize(pending), token: undefined };
    const { token, fields } = freshToken();
    const invitation = await tx.invitation.create({
      data: { ...fields, organizationId, storeId, invitedById: ownerId, email },
    });
    return { summary: summarize(invitation), token };
  });
}

export function changeInvitation(
  db: MembershipDatabase,
  organizationId: string,
  ownerId: string,
  id: string,
  action: "revoke" | "resend",
) {
  return ownerChange(db, organizationId, ownerId, async (tx) => {
    if (!uuidPattern.test(id)) throw new AccessError("ACCESS_DENIED");
    const invite = await tx.invitation.findFirst({
      where: { id, organizationId },
    });
    if (!invite) throw new AccessError("ACCESS_DENIED");
    if (invite.acceptedAt || invite.revokedAt)
      throw new AccessError("INVITATION_UNAVAILABLE");
    if (action === "revoke") {
      return {
        summary: summarize(
          await tx.invitation.update({
            where: { id },
            data: { revokedAt: new Date() },
          }),
        ),
        token: undefined,
      };
    }
    const { token, fields } = freshToken();
    return {
      summary: summarize(
        await tx.invitation.update({ where: { id }, data: fields }),
      ),
      token,
    };
  });
}

export function acceptInvitation(
  db: MembershipDatabase,
  userId: string,
  token: string,
  email: string,
) {
  const digest = tokenDigest(token);
  return db.$transaction(async (tx) => {
    const found = await tx.invitation.findUnique({
      where: { tokenDigest: digest },
      select: { organizationId: true },
    });
    if (!found) throw new AccessError("INVITATION_UNAVAILABLE");
    const { organizationId } = found;
    await lockOrganization(tx, organizationId);
    const invite = await tx.invitation.findUnique({
      where: { tokenDigest: digest },
    });
    if (
      !invite ||
      invite.email !== email ||
      summarize(invite).status !== "pending"
    )
      throw new AccessError("INVITATION_UNAVAILABLE");
    const { storeId, id } = invite;
    const membership = { organizationId, userId };
    await tx.organizationMembership.createMany({
      data: [{ ...membership, role: "SALESPERSON" }],
      skipDuplicates: true,
    });
    const member = await tx.organizationMembership.findUniqueOrThrow({
      where: { organizationId_userId: membership },
    });
    if (!member.active || member.role !== "SALESPERSON")
      throw new AccessError("INVITATION_UNAVAILABLE");
    const scope = { ...membership, storeId };
    await tx.storeAssignment.createMany({
      data: [scope],
      skipDuplicates: true,
    });
    const assignment = await tx.storeAssignment.findUniqueOrThrow({
      where: { organizationId_storeId_userId: scope },
    });
    if (!assignment.active) throw new AccessError("INVITATION_UNAVAILABLE");
    await tx.invitation.update({
      where: { id },
      data: { acceptedAt: new Date(), acceptedById: userId },
    });
    return { organizationId, storeId };
  });
}

export function changeMember(
  db: MembershipDatabase,
  organizationId: string,
  ownerId: string,
  userId: string,
  change: { active: boolean } | { storeId: string; assign: boolean },
) {
  return ownerChange(db, organizationId, ownerId, async (tx) => {
    const identity = { organizationId, userId };
    if (
      !uuidPattern.test(userId) ||
      !(await tx.organizationMembership.findFirst({
        where: { ...identity, role: "SALESPERSON" },
        select: { userId: true },
      }))
    )
      throw new AccessError("ACCESS_DENIED");
    if ("active" in change) {
      await tx.organizationMembership.update({
        where: { organizationId_userId: identity },
        data: change,
      });
    } else {
      const { storeId, assign } = change;
      await assertStore(tx, organizationId, storeId);
      const scope = { ...identity, storeId };
      if (assign) {
        await tx.storeAssignment.upsert({
          where: { organizationId_storeId_userId: scope },
          create: scope,
          update: { active: true },
        });
      } else {
        await tx.storeAssignment.updateMany({
          where: scope,
          data: { active: false },
        });
      }
    }
    return { ok: true };
  });
}
