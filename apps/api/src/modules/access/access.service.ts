import type { Prisma } from "@mizan/database";
import type { OrganizationSettings } from "@mizan/contracts";
import { AccessError } from "./access.errors.js";

export type AccessDatabase = Pick<
  Prisma.TransactionClient,
  "user" | "storeAssignment" | "salespersonDisplaySession"
>;

export interface AuthIdentity {
  userId: string;
  sessionId?: string;
  salespersonDisplay?: true;
}

export interface AccessContext extends Pick<
  AuthIdentity,
  "userId" | "salespersonDisplay"
> {
  organizationId: string;
  storeId: string;
  role: "OWNER" | "SALESPERSON";
  settings: OrganizationSettings;
}

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const actorProfile = {
  select: { membership: { select: { user: { select: { fullName: true } } } } },
} as const;

export async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "mizan"."User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
}

export async function ensureApplicationUser(
  db: AccessDatabase,
  identity: AuthIdentity,
): Promise<void> {
  await db.user.createMany({
    data: [{ id: identity.userId }],
    skipDuplicates: true,
  });
}

export async function resolveAccessContext(
  db: AccessDatabase,
  identity: AuthIdentity,
  organizationId: string,
  storeId: string,
): Promise<AccessContext> {
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(storeId)) {
    throw new AccessError("ACCESS_DENIED");
  }
  const assignment = await db.storeAssignment.findFirst({
    where: {
      organizationId,
      storeId,
      userId: identity.userId,
      active: true,
      membership: { active: true },
    },
    select: {
      organizationId: true,
      storeId: true,
      membership: {
        select: {
          role: true,
          organization: {
            select: {
              defaultCurrency: true,
              paymentCurrencies: true,
              salespersonCanViewAcquisitionCost: true,
            },
          },
        },
      },
    },
  });
  if (!assignment) throw new AccessError("ACCESS_DENIED");

  return {
    userId: identity.userId,
    ...(identity.salespersonDisplay && { salespersonDisplay: true }),
    organizationId: assignment.organizationId,
    storeId: assignment.storeId,
    role: assignment.membership.role,
    settings: {
      defaultCurrency: assignment.membership.organization.defaultCurrency,
      salespersonCanViewAcquisitionCost:
        assignment.membership.organization.salespersonCanViewAcquisitionCost,
      ...(assignment.membership.organization.paymentCurrencies?.length && {
        paymentCurrencies: assignment.membership.organization.paymentCurrencies,
      }),
    },
  };
}
