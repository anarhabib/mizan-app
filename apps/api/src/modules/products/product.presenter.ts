import {
  currencyMinorUnits,
  type AcquisitionBreakdown,
  type ProductDetail,
  type ProductListItem,
} from "@mizan/contracts";
import type { Prisma } from "@mizan/database";
import { actorProfile, type AccessContext } from "../access/access.service.js";
import {
  canManageAsOwner,
  canViewAcquisition,
} from "../access/display-mode.js";

export const listFields = {
  id: true,
  code: true,
  name: true,
  category: true,
  productCategory: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      sortOrder: true,
    },
  },
  purity: true,
  weight: true,
  status: true,
  sale: { select: { outstandingDebt: true } },
  saleItem: { select: { sale: { select: { outstandingDebt: true } } } },
} as const satisfies Prisma.ProductSelect;

export const gemstoneFields = {
  orderBy: { position: "asc" },
  select: {
    gemstoneType: true,
    stoneCount: true,
    origin: true,
    totalCarats: true,
    individualCarats: true,
    shape: true,
    color: true,
    clarity: true,
    cutGrade: true,
    treatment: true,
    laboratory: true,
    reportNumber: true,
    note: true,
  },
} as const;

export function detailFields(access: AccessContext) {
  const owner = canManageAsOwner(access);
  return {
    ...listFields,
    historicalSupplierId: owner,
    historicalSupplierName: owner,
    purchaseItem: {
      select: {
        purchaseId: true,
        purchase: {
          select: {
            supplierId: true,
            supplierName: true,
            documentNumber: true,
            purchaseDate: true,
            supplier: { select: { name: true } },
          },
        },
      },
    },
    metalType: true,
    netGoldWeight: true,
    grade: { select: { active: true } },
    ...acquisitionFields(access),
    setMembership: { select: { setId: true } },
    fixedSellingAmount: true,
    fixedSellingCurrency: true,
    gemstones: gemstoneFields,
    note: true,
    createdAt: true,
    photoObjectKey: true,
    photoContentType: true,
    photoSize: true,
    movements: {
      select: {
        id: true,
        kind: true,
        registrationSource: true,
        actorId: true,
        actor: actorProfile,
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    },
    sale: {
      select: {
        id: true,
        saleAmount: true,
        currency: true,
        createdAt: true,
        outstandingDebt: true,
      },
    },
    saleItem: {
      select: {
        saleAmount: true,
        sale: {
          select: {
            id: true,
            currency: true,
            createdAt: true,
            outstandingDebt: true,
          },
        },
      },
    },
  } as const satisfies Prisma.ProductSelect;
}

export function acquisitionFields(access: AccessContext) {
  const showCost = canViewAcquisition(access);
  const owner = canManageAsOwner(access);
  return {
    acquisitionCost: showCost,
    acquisitionCostPerGram: showCost,
    acquisitionCurrency: showCost,
    acquisitionMetal: owner,
    acquisitionGemstones: owner,
    acquisitionWorkmanship: owner,
    acquisitionOther: owner,
  } as const;
}

export type DetailRow = Prisma.ProductGetPayload<{
  select: ReturnType<typeof detailFields>;
}>;

export function presentListItem(
  row: Prisma.ProductGetPayload<{ select: typeof listFields }>,
): ProductListItem {
  const { id, code, name, category, purity, weight, status } = row;
  const sale = row.saleItem?.sale ?? row.sale;
  return {
    id,
    code,
    name,
    category: row.productCategory?.name ?? category,
    ...(row.productCategory && { productCategory: row.productCategory }),
    purity,
    weight: weight.toFixed(3),
    status,
    ...(status === "SOLD" &&
      sale?.outstandingDebt.gt(0) && { hasOutstandingDebt: true }),
  };
}

export function presentMoney(value: Prisma.Decimal, currency: string) {
  return {
    amount: value.toFixed(
      Math.max(value.decimalPlaces(), currencyMinorUnits(currency)),
    ),
    currency,
  };
}

export function presentFixedSellingPrice({
  fixedSellingAmount,
  fixedSellingCurrency,
}: Pick<DetailRow, "fixedSellingAmount" | "fixedSellingCurrency">) {
  return fixedSellingAmount && fixedSellingCurrency
    ? {
        fixedSellingPrice: presentMoney(
          fixedSellingAmount,
          fixedSellingCurrency,
        ),
      }
    : {};
}

export function presentAcquisition(
  row: Pick<DetailRow, keyof ReturnType<typeof acquisitionFields>> & {
    purchaseItem: object | null;
  },
  access: AccessContext,
) {
  const { acquisitionCost, acquisitionCostPerGram, acquisitionCurrency } = row;
  const owner = canManageAsOwner(access);
  const showCost = canViewAcquisition(access) && (owner || !row.purchaseItem);
  const breakdown: AcquisitionBreakdown = {};
  if (owner) {
    if (row.acquisitionMetal) breakdown.metal = row.acquisitionMetal.toFixed();
    if (row.acquisitionGemstones)
      breakdown.gemstones = row.acquisitionGemstones.toFixed();
    if (row.acquisitionWorkmanship)
      breakdown.workmanship = row.acquisitionWorkmanship.toFixed();
    if (row.acquisitionOther) breakdown.other = row.acquisitionOther.toFixed();
  }
  return {
    ...(Object.keys(breakdown).length > 0 && {
      acquisitionBreakdown: breakdown,
    }),
    ...(showCost &&
      (owner || acquisitionCostPerGram) &&
      acquisitionCost &&
      acquisitionCurrency && {
        acquisitionCost: presentMoney(acquisitionCost, acquisitionCurrency),
      }),
    ...(showCost &&
      acquisitionCostPerGram &&
      acquisitionCurrency && {
        acquisitionCostPerGram: presentMoney(
          acquisitionCostPerGram,
          acquisitionCurrency,
        ),
      }),
  };
}

export function canEditAcquisition(row: DetailRow) {
  return (
    row.status === "IN_STOCK" &&
    !row.sale &&
    !row.saleItem &&
    !row.purchaseItem &&
    row.movements.every(
      ({ kind }) =>
        kind === "PRODUCT_ADDED" ||
        kind === "REPAIR_SENT" ||
        kind === "REPAIR_CANCELED",
    )
  );
}

export function presentGemstones(groups: DetailRow["gemstones"]) {
  return groups.map(
    ({
      gemstoneType,
      stoneCount,
      origin,
      totalCarats,
      individualCarats,
      shape,
      color,
      clarity,
      cutGrade,
      treatment,
      laboratory,
      reportNumber,
      note,
    }) => ({
      gemstoneType,
      stoneCount,
      origin,
      ...(totalCarats && { totalCarats: totalCarats.toFixed() }),
      ...(individualCarats && {
        individualCarats: individualCarats.toFixed(),
      }),
      ...(shape && { shape }),
      ...(color && { color }),
      ...(clarity && { clarity }),
      ...(cutGrade && { cutGrade }),
      ...(treatment && { treatment }),
      ...(laboratory && { laboratory }),
      ...(reportNumber && { reportNumber }),
      ...(note && { note }),
    }),
  );
}

export function presentDetail(
  row: DetailRow,
  photoUrl: string | null,
  access: AccessContext,
): ProductDetail {
  const {
    note,
    createdAt,
    movements,
    sale: legacySale,
    saleItem,
    photoContentType,
    photoSize,
  } = row;
  const sale = saleItem
    ? { ...saleItem.sale, saleAmount: saleItem.saleAmount }
    : legacySale;
  const owner = canManageAsOwner(access);
  const purchase = row.purchaseItem?.purchase;
  const registrationSource = movements.find(
    ({ registrationSource }) => registrationSource,
  )?.registrationSource;
  return {
    ...presentListItem(row),
    ...(owner && registrationSource && { registrationSource }),
    ...(owner &&
      row.historicalSupplierId &&
      row.historicalSupplierName && {
        historicalSupplier: {
          id: row.historicalSupplierId,
          name: row.historicalSupplierName,
        },
      }),
    ...(owner &&
      purchase &&
      row.purchaseItem && {
        purchase: {
          id: row.purchaseItem.purchaseId,
          supplierId: purchase.supplierId,
          supplierName: purchase.supplierName ?? purchase.supplier.name,
          documentNumber: purchase.documentNumber,
          purchaseDate: purchase.purchaseDate.toISOString().slice(0, 10),
        },
      }),
    metalType: row.metalType,
    ...(row.netGoldWeight && {
      netGoldWeight: row.netGoldWeight.toFixed(3),
      ...(row.metalType === "GOLD" && {
        fineGoldWeight: row.netGoldWeight.times(row.purity).div(1000).toFixed(),
      }),
    }),
    ...(row.gemstones.length > 0 && {
      gemstones: presentGemstones(row.gemstones),
    }),
    ...presentFixedSellingPrice(row),
    ...presentAcquisition(row, access),
    ...(owner && {
      canEditAcquisition: canEditAcquisition(row),
      canDelete:
        row.status === "IN_STOCK" &&
        !sale &&
        !row.purchaseItem &&
        !row.historicalSupplierId &&
        !row.setMembership &&
        movements.length === 0,
    }),
    note,
    createdAt: createdAt.toISOString(),
    photo:
      photoUrl && photoContentType && photoSize !== null
        ? { url: photoUrl, contentType: photoContentType, size: photoSize }
        : null,
    movements: movements.map(({ actor, registrationSource, ...movement }) => ({
      ...movement,
      ...(owner && registrationSource && { registrationSource }),
      actorName: actor.membership.user.fullName,
      createdAt: movement.createdAt.toISOString(),
    })),
    sale: sale
      ? {
          id: sale.id,
          total: presentMoney(sale.saleAmount, sale.currency),
          createdAt: sale.createdAt.toISOString(),
        }
      : null,
  };
}
