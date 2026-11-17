import type { Prisma } from "@mizan/database";
import { AccessError } from "./access.errors.js";
import { uuidPattern } from "./access.service.js";

type Tx = Prisma.TransactionClient;
export type OrganizationDatabase = Tx & {
  $transaction<T>(callback: (tx: Tx) => Promise<T>): Promise<T>;
};

export async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.$queryRaw`SELECT "id" FROM "mizan"."Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
}

export async function assertOwner(
  db: Tx,
  organizationId: string,
  userId: string,
) {
  if (
    !uuidPattern.test(organizationId) ||
    !(await db.organizationMembership.findFirst({
      where: { organizationId, userId, active: true, role: "OWNER" },
      select: { userId: true },
    }))
  )
    throw new AccessError("ACCESS_DENIED");
}

export function ownerChange<T>(
  db: OrganizationDatabase,
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
