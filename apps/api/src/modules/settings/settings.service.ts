import type { OldGoldRate, TradingSettings } from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
import {
  assertOwner,
  ownerChange,
  type OrganizationDatabase,
} from "../access/organization-owner.js";

const settingsSelect = {
  defaultCurrency: true,
  salespersonCanViewAcquisitionCost: true,
} as const;

export async function getTradingSettings(
  db: OrganizationDatabase,
  organizationId: string,
  ownerId: string,
): Promise<TradingSettings> {
  await assertOwner(db, organizationId, ownerId);
  const { purities, ...organization } = await db.organization.findUniqueOrThrow(
    {
      where: { id: organizationId },
      select: {
        ...settingsSelect,
        purities: {
          select: { value: true, active: true },
          orderBy: { value: "asc" },
        },
      },
    },
  );
  const entries = await db.oldGoldRate.findMany({
    where: { organizationId },
    orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      purity: true,
      currency: true,
      amountPerGram: true,
      effectiveAt: true,
      grade: { select: { active: true } },
    },
  });
  const seen = new Set<string>();
  const rates: OldGoldRate[] = entries.map(
    ({ grade, amountPerGram, effectiveAt, ...entry }) => {
      const key = `${entry.purity}:${entry.currency}`;
      const current = grade.active && !seen.has(key);
      seen.add(key);
      return {
        ...entry,
        current,
        amountPerGram: amountPerGram.toFixed(4),
        effectiveAt: effectiveAt.toISOString(),
      };
    },
  );
  return { settings: organization, purities, rates };
}

export function setCostVisibility(
  db: OrganizationDatabase,
  organizationId: string,
  ownerId: string,
  salespersonCanViewAcquisitionCost: boolean,
) {
  return ownerChange(db, organizationId, ownerId, (tx) =>
    tx.organization.update({
      where: { id: organizationId },
      data: { salespersonCanViewAcquisitionCost },
      select: settingsSelect,
    }),
  );
}

export function changePurity(
  db: OrganizationDatabase,
  organizationId: string,
  ownerId: string,
  value: number,
  action: "add" | "deactivate",
) {
  return ownerChange(db, organizationId, ownerId, async (tx) => {
    const scope = { organizationId, value };
    const where = { organizationId_value: scope };
    const select = { value: true, active: true };
    const existing = await tx.purityGrade.findUnique({ where, select });
    if (action === "add") {
      if (existing) throw new AccessError("PURITY_CONFLICT");
      return tx.purityGrade.create({ data: scope, select });
    }
    if (!existing) throw new AccessError("PURITY_CONFLICT");
    return tx.purityGrade.update({ where, data: { active: false }, select });
  });
}

export function appendOldGoldRate(
  db: OrganizationDatabase,
  organizationId: string,
  ownerId: string,
  rate: {
    purity: number;
    currency: string;
    amountPerGram: string;
  },
): Promise<OldGoldRate> {
  return ownerChange(db, organizationId, ownerId, async (tx) => {
    const grade = await tx.purityGrade.findUnique({
      where: { organizationId_value: { organizationId, value: rate.purity } },
    });
    if (!grade?.active) throw new AccessError("PURITY_CONFLICT");
    const previous = await tx.oldGoldRate.findFirst({
      where: { organizationId, purity: rate.purity, currency: rate.currency },
      orderBy: { effectiveAt: "desc" },
      select: { effectiveAt: true },
    });
    // Writes are serialized per organization. Keep order stable even within one clock tick.
    const effectiveAt = new Date(
      Math.max(Date.now(), previous ? previous.effectiveAt.getTime() + 1 : 0),
    );
    const { id, amountPerGram } = await tx.oldGoldRate.create({
      data: { ...rate, organizationId, actorId: ownerId, effectiveAt },
      select: { id: true, amountPerGram: true },
    });
    return {
      ...rate,
      id,
      amountPerGram: amountPerGram.toFixed(4),
      effectiveAt: effectiveAt.toISOString(),
      current: true,
    };
  });
}
