import type { Prisma } from "@mizan/database";
import { lockOrganization } from "../access/organization-owner.js";
import {
  resolveAccessContext,
  type AccessContext,
} from "../access/access.service.js";

export async function resolveSaleMutationAccess(
  tx: Prisma.TransactionClient,
  context: AccessContext,
  sessionId: string | undefined,
) {
  const { organizationId, storeId, userId } = context;
  await lockOrganization(tx, organizationId);
  const restricted =
    context.salespersonDisplay ||
    (sessionId &&
      (await tx.salespersonDisplaySession.findUnique({
        where: { sessionId, userId },
        select: { sessionId: true },
      })));
  return resolveAccessContext(
    tx,
    restricted ? { ...context, salespersonDisplay: true } : context,
    organizationId,
    storeId,
  );
}
