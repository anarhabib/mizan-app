import {
  defaultCategoryLabels,
  defaultPurities,
  OnboardingRequest,
  OnboardingResult,
  StoreContext,
} from "@mizan/contracts";
import type { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";
import { lockUser, resolveAccessContext } from "../access/access.service.js";

export type OnboardingDatabase = Pick<
  Prisma.TransactionClient,
  "storeAssignment"
> & {
  $transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
};

export function provisionOwnerWorkspace(
  db: OnboardingDatabase,
  userId: string,
  input: OnboardingRequest,
): Promise<OnboardingResult> {
  return db.$transaction(async (tx) => {
    // Serialize retries for this identity, including when the receipt does not exist yet.
    await lockUser(tx, userId);
    const existing = await tx.ownerOnboarding.findUnique({ where: { userId } });
    if (existing) {
      const { organizationId, storeId } = existing;
      const context = await resolveAccessContext(
        tx,
        { userId },
        organizationId,
        storeId,
      );
      if (context.role !== "OWNER") throw new AccessError("ACCESS_DENIED");
      await tx.user.updateMany({
        where: { id: userId, fullName: null },
        data: { fullName: input.fullName },
      });
      return {
        organizationId,
        storeId,
        membershipId: `${organizationId}:${userId}`,
      };
    }

    const membership = await tx.organizationMembership.findFirst({
      where: { userId },
      select: { userId: true },
    });
    if (membership) throw new AccessError("ACCESS_DENIED");
    await tx.user.updateMany({
      where: { id: userId, fullName: null },
      data: { fullName: input.fullName },
    });
    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        defaultCurrency: input.defaultCurrency,
        purities: { create: defaultPurities.map((value) => ({ value })) },
        productCategories: {
          create: Object.entries(defaultCategoryLabels).map(
            ([code, labels], sortOrder) => ({
              code,
              name: labels.az,
              sortOrder,
            }),
          ),
        },
      },
      select: { id: true },
    });
    const organizationId = organization.id;
    const { id: storeId } = await tx.store.create({
      data: { organizationId, name: input.storeName },
      select: { id: true },
    });
    await tx.organizationMembership.create({
      data: { userId, organizationId, role: "OWNER" },
    });
    await tx.storeAssignment.create({
      data: { userId, organizationId, storeId },
    });
    await tx.ownerOnboarding.create({
      data: { userId, organizationId, storeId },
    });
    return {
      organizationId,
      storeId,
      membershipId: `${organizationId}:${userId}`,
    };
  });
}

export async function listStoreContexts(
  db: OnboardingDatabase,
  userId: string,
): Promise<StoreContext[]> {
  const assignments = await db.storeAssignment.findMany({
    where: { userId, active: true, membership: { active: true } },
    select: {
      organizationId: true,
      storeId: true,
      store: { select: { name: true } },
      membership: {
        select: { role: true, organization: { select: { name: true } } },
      },
    },
    orderBy: [
      { membership: { organization: { name: "asc" } } },
      { store: { name: "asc" } },
      { storeId: "asc" },
    ],
  });
  return assignments.map(({ organizationId, storeId, membership, store }) => ({
    organizationId,
    organizationName: membership.organization.name,
    storeId,
    storeName: store.name,
    role: membership.role,
  }));
}
