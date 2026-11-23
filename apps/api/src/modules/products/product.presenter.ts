import {
  currencyMinorUnits,
  type AcquisitionBreakdown,
  type ProductDetail,
  type ProductListItem,
} from "@mizan/contracts";
import type { Prisma } from "@mizan/database";
import type { AccessContext } from "../access/access.service.js";
import {
  canManageAsOwner,
  canViewAcquisition,
} from "../access/display-mode.js";

export const listFields = {
  id: true,
  code: true,
  name: true,
  category: true,
  purity: true,
  weight: true,
  status: true,
  sale: { select: { outstandingDebt: true } },
  saleItem: { select: { sale: { select: { outstandingDebt: true } } } },
} as const satisfies Prisma.ProductSelect;

export function detailFields(access: AccessContext) {
  const showCost = canViewAcquisition(access);
  const owner = canManageAsOwner(access);
  return {
    ...listFields,
    metalType: true,
    netGoldWeight: true,
    grade: { select: { active: true } },
    acquisitionCost: showCost,
    acquisitionCostPerGram: showCost,
    acquisitionCurrency: showCost,
    acquisitionMetal: owner,
    acquisitionGemstones: owner,
    acquisitionWorkmanship: owner,
    acquisitionOther: owner,
    fixedSellingAmount: true,
    fixedSellingCurrency: true,
    gemstones: {
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
    },
    note: true,
    createdAt: true,
    photoObjectKey: true,
    photoContentType: true,
    photoSize: true,
    movements: {
      select: { id: true, kind: true, actorId: true, createdAt: true },
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
    category,
    purity,
    weight: weight.toFixed(3),
    status,
    ...(status === "SOLD" &&
      sale?.outstandingDebt.gt(0) && { hasOutstandingDebt: true }),
  };
}

function presentMoney(value: Prisma.Decimal, currency: string) {
  return {
    amount: value.toFixed(
      Math.max(value.decimalPlaces(), currencyMinorUnits(currency)),
    ),
    currency,
  };
}

export function canEditAcquisition(row: DetailRow) {
  return (
    row.status === "IN_STOCK" &&
    !row.sale &&
    !row.saleItem &&
    row.movements.every(({ kind }) => kind === "PRODUCT_ADDED")
  );
}

export function presentDetail(
  row: DetailRow,
  photoUrl: string | null,
  access: AccessContext,
): ProductDetail {
  const {
    acquisitionCost,
    acquisitionCostPerGram,
    acquisitionCurrency,
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
  const breakdown: AcquisitionBreakdown = {};
  const owner = canManageAsOwner(access);
  if (owner) {
    if (row.acquisitionMetal) breakdown.metal = row.acquisitionMetal.toFixed();
    if (row.acquisitionGemstones)
      breakdown.gemstones = row.acquisitionGemstones.toFixed();
    if (row.acquisitionWorkmanship)
      breakdown.workmanship = row.acquisitionWorkmanship.toFixed();
    if (row.acquisitionOther) breakdown.other = row.acquisitionOther.toFixed();
  }
  return {
    ...presentListItem(row),
    metalType: row.metalType,
    ...(row.netGoldWeight && {
      netGoldWeight: row.netGoldWeight.toFixed(3),
      ...(row.metalType === "GOLD" && {
        fineGoldWeight: row.netGoldWeight.times(row.purity).div(1000).toFixed(),
      }),
    }),
    ...(row.gemstones.length > 0 && {
      gemstones: row.gemstones.map(
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
      ),
    }),
    ...(row.fixedSellingAmount &&
      row.fixedSellingCurrency && {
        fixedSellingPrice: presentMoney(
          row.fixedSellingAmount,
          row.fixedSellingCurrency,
        ),
      }),
    ...(Object.keys(breakdown).length > 0 && {
      acquisitionBreakdown: breakdown,
    }),
    ...((owner || acquisitionCostPerGram) &&
      acquisitionCost &&
      acquisitionCurrency && {
        acquisitionCost: presentMoney(acquisitionCost, acquisitionCurrency),
      }),
    ...(acquisitionCostPerGram &&
      acquisitionCurrency && {
        acquisitionCostPerGram: presentMoney(
          acquisitionCostPerGram,
          acquisitionCurrency,
        ),
      }),
    ...(owner && {
      canEditAcquisition: canEditAcquisition(row),
      canDelete: row.status === "IN_STOCK" && !sale && movements.length === 0,
    }),
    note,
    createdAt: createdAt.toISOString(),
    photo:
      photoUrl && photoContentType && photoSize !== null
        ? { url: photoUrl, contentType: photoContentType, size: photoSize }
        : null,
    movements: movements.map((movement) => ({
      ...movement,
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
