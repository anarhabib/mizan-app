import { configuredCurrencies, type TradingSettings } from "@mizan/contracts";
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
        paymentCurrencies: true,
        purities: {
          select: { value: true, active: true },
          orderBy: { value: "asc" },
        },
      },
    },
  );
  const { paymentCurrencies, ...settings } = organization;
  return {
    settings: {
      ...settings,
      ...(paymentCurrencies.length && { paymentCurrencies }),
    },
    purities,
  };
}

export function setCurrencies(
  db: OrganizationDatabase,
  organizationId: string,
  ownerId: string,
  body: unknown,
) {
  return ownerChange(db, organizationId, ownerId, async (tx) => {
    const { defaultCurrency, paymentCurrencies } = (body ?? {}) as Record<
      string,
      unknown
    >;
    const current = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { defaultCurrency: true, paymentCurrencies: true },
    });
    const allowed = new Set<string>([
      ...configuredCurrencies,
      current.defaultCurrency,
      ...current.paymentCurrencies,
    ]);
    if (
      typeof defaultCurrency !== "string" ||
      !allowed.has(defaultCurrency) ||
      !Array.isArray(paymentCurrencies) ||
      paymentCurrencies.length > allowed.size ||
      !paymentCurrencies.every((code) => allowed.has(code)) ||
      !paymentCurrencies.includes(defaultCurrency) ||
      new Set(paymentCurrencies).size !== paymentCurrencies.length
    )
      throw new AccessError("INVALID_SETTINGS");
    return tx.organization.update({
      where: { id: organizationId },
      data: { defaultCurrency, paymentCurrencies },
      select: { defaultCurrency: true, paymentCurrencies: true },
    });
  });
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
  action: "add" | "deactivate" | "reactivate",
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
    return tx.purityGrade.update({
      where,
      data: { active: action === "reactivate" },
      select,
    });
  });
}
