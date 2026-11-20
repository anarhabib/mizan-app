import {
  currencyMinorUnits,
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
} as const satisfies Prisma.ProductSelect;

export function detailFields(access: AccessContext) {
  const showCost = canViewAcquisition(access);
  return {
    ...listFields,
    acquisitionCost: showCost,
    acquisitionCostPerGram: showCost,
    acquisitionCurrency: showCost,
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
      select: { id: true, saleAmount: true, currency: true, createdAt: true },
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
  return {
    id,
    code,
    name,
    category,
    purity,
    weight: weight.toFixed(3),
    status,
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
    sale,
    photoContentType,
    photoSize,
  } = row;
  return {
    ...presentListItem(row),
    ...(acquisitionCost &&
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
    ...(canManageAsOwner(access) && {
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
