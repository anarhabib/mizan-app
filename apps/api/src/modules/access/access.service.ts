import type { Prisma } from "@mizan/database";
import { AccessError } from "./access.errors.js";

export type AccessDatabase = Pick<
  Prisma.TransactionClient,
  "user" | "storeAssignment"
>;

export interface AuthIdentity {
  userId: string;
}

export interface AccessContext extends AuthIdentity {
  organizationId: string;
  storeId: string;
  role: "OWNER" | "SALESPERSON";
  settings: {
    defaultCurrency: string;
    salespersonCanViewAcquisitionCost: boolean;
  };
}

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    organizationId: assignment.organizationId,
    storeId: assignment.storeId,
    role: assignment.membership.role,
    settings: assignment.membership.organization,
  };
}
