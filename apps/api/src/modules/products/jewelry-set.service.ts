import { Prisma } from "@mizan/database";
import {
  currencyMinorUnits,
  type JewelrySetDetail,
  type JewelrySetInput,
  type JewelrySetList,
  type JewelrySetPreview,
  type JewelrySetProduct,
  type JewelrySetTotals,
  type SaleJewelrySetSelection,
} from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
import { uuidPattern, type AccessContext } from "../access/access.service.js";
import { canManageAsOwner } from "../access/display-mode.js";
import type { OrganizationDatabase } from "../access/organization-owner.js";
import { readPageSize } from "../access/page-size.js";
import {
  acquisitionFields,
  presentAcquisition,
  presentFixedSellingPrice,
} from "./product.presenter.js";
import { lockProductOwner } from "./product.service.js";

// Decimal(20, 4) acquisition amounts can gain digits when summed.
const SetDecimal = Prisma.Decimal.clone({ precision: 24 });
const weights = { weight: true, netGoldWeight: true, status: true } as const;
const inStock = { status: "IN_STOCK", sale: null, saleItem: null } as const;

function scope({ organizationId, storeId }: AccessContext) {
  return { organizationId, storeId };
}

function productFields(access: AccessContext) {
  return {
    ...weights,
    id: true,
    code: true,
    name: true,
    purity: true,
    category: true,
    fixedSellingAmount: true,
    fixedSellingCurrency: true,
    _count: { select: { gemstones: true } },
    productCategory: {
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        sortOrder: true,
      },
    },
    purchaseItem: { select: { purchaseId: true } },
    ...acquisitionFields(access),
  } as const satisfies Prisma.ProductSelect;
}

type WeightRow = Prisma.ProductGetPayload<{ select: typeof weights }>;
type ProductRow = Prisma.ProductGetPayload<{
  select: ReturnType<typeof productFields>;
}>;

function weightTotals(products: WeightRow[]) {
  let gross = new SetDecimal(0);
  let net = new SetDecimal(0);
  let missingNetWeight = false;
  let unavailableCount = 0;
  for (const product of products) {
    gross = gross.plus(product.weight);
    if (product.netGoldWeight) net = net.plus(product.netGoldWeight);
    else missingNetWeight = true;
    if (product.status !== "IN_STOCK") unavailableCount += 1;
  }
  return {
    itemCount: products.length,
    unavailableCount,
    grossWeight: gross.toFixed(3),
    ...(!missingNetWeight && { netGoldWeight: net.toFixed(3) }),
  };
}

function acquisitionTotals(products: JewelrySetProduct[]) {
  const amounts = new Map<string, Prisma.Decimal>();
  for (const { acquisitionCost: cost } of products) {
    // Exposing a partial or complete aggregate could reveal hidden costs.
    if (!cost) return undefined;
    const total = amounts.get(cost.currency) ?? new SetDecimal(0);
    amounts.set(cost.currency, total.plus(cost.amount));
  }
  return [...amounts.keys()].sort().map((currency) => {
    const total = amounts.get(currency)!;
    return {
      currency,
      amount: total.toFixed(
        Math.max(total.decimalPlaces(), currencyMinorUnits(currency)),
      ),
    };
  });
}

function presentProducts(
  rows: ProductRow[],
  access: AccessContext,
): JewelrySetPreview {
  const products = rows.map((row): JewelrySetProduct => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.productCategory?.name ?? row.category,
    ...(row.productCategory && { productCategory: row.productCategory }),
    purity: row.purity,
    weight: row.weight.toFixed(3),
    status: row.status,
    ...(row._count.gemstones > 0 && { hasGemstones: true }),
    ...(row.netGoldWeight && { netGoldWeight: row.netGoldWeight.toFixed(3) }),
    ...presentFixedSellingPrice(row),
    ...presentAcquisition(row, access),
  }));
  const totals: JewelrySetTotals = { ...weightTotals(rows) };
  const acquisitionValues = acquisitionTotals(products);
  if (acquisitionValues) totals.acquisitionValues = acquisitionValues;
  return { products, totals };
}

export async function listJewelrySets(
  db: OrganizationDatabase,
  access: AccessContext,
  {
    q,
    after,
    limit,
    availability,
  }: {
    q?: string;
    after?: string;
    limit?: string;
    availability?: string;
  },
): Promise<JewelrySetList> {
  const size = readPageSize(limit, "INVALID_JEWELRY_SET");
  if (
    q !== undefined &&
    (typeof q !== "string" || q.length > 160 || q.includes("\0"))
  )
    throw new AccessError("INVALID_JEWELRY_SET", "q");
  if (
    after !== undefined &&
    (typeof after !== "string" || !uuidPattern.test(after))
  )
    throw new AccessError("INVALID_JEWELRY_SET", "after");
  if (
    availability !== undefined &&
    availability !== "available" &&
    availability !== "unavailable"
  )
    throw new AccessError("INVALID_JEWELRY_SET", "availability");
  const search = q?.trim().replace(/[\\%_]/g, "\\$&");
  const unavailable = { product: { status: { not: "IN_STOCK" as const } } };
  const rows = await db.$transaction(
    (tx) =>
      tx.jewelrySet.findMany({
        where: {
          ...scope(access),
          id: after ? { gt: after } : undefined,
          OR: search
            ? [
                { name: { contains: search, mode: "insensitive" } },
                {
                  members: {
                    some: {
                      product: {
                        OR: [
                          { code: { contains: search, mode: "insensitive" } },
                          { name: { contains: search, mode: "insensitive" } },
                        ],
                      },
                    },
                  },
                },
              ]
            : undefined,
          members:
            availability === "available"
              ? { none: unavailable }
              : availability === "unavailable"
                ? { some: unavailable }
                : undefined,
        },
        orderBy: { id: "asc" },
        take: size + 1,
        select: {
          id: true,
          name: true,
          members: { select: { product: { select: weights } } },
        },
      }),
    { isolationLevel: "RepeatableRead" },
  );
  const page = rows.slice(0, size);
  return {
    items: page.map(({ id, name, members }) => ({
      id,
      name,
      totals: weightTotals(members.map(({ product }) => product)),
    })),
    nextCursor: rows.length > size ? page.at(-1)?.id : undefined,
  };
}

function setWhere(access: AccessContext, id: string) {
  if (typeof id !== "string" || !uuidPattern.test(id))
    throw new AccessError("JEWELRY_SET_NOT_FOUND");
  return { ...scope(access), id: id.toLowerCase() };
}

async function readSet(
  tx: Prisma.TransactionClient,
  access: AccessContext,
  id: string,
): Promise<JewelrySetDetail> {
  const row = await tx.jewelrySet.findUnique({
    where: { organizationId_storeId_id: setWhere(access, id) },
    select: {
      id: true,
      name: true,
      description: true,
      revision: true,
      members: {
        orderBy: { product: { code: "asc" } },
        select: { product: { select: productFields(access) } },
      },
    },
  });
  if (!row) throw new AccessError("JEWELRY_SET_NOT_FOUND");
  const { members, ...set } = row;
  return {
    ...set,
    ...presentProducts(
      members.map(({ product }) => product),
      access,
    ),
  };
}

export function getJewelrySet(
  db: OrganizationDatabase,
  access: AccessContext,
  id: string,
) {
  return db.$transaction((tx) => readSet(tx, access, id), {
    isolationLevel: "RepeatableRead",
  });
}

export async function previewJewelrySet(
  db: OrganizationDatabase,
  access: AccessContext,
  ids: string[],
) {
  if (!canManageAsOwner(access)) throw new AccessError("ACCESS_DENIED");
  const products = await db.$transaction(
    (tx) =>
      tx.product.findMany({
        where: { ...scope(access), id: { in: ids } },
        orderBy: { code: "asc" },
        select: productFields(access),
      }),
    { isolationLevel: "RepeatableRead" },
  );
  if (products.length !== ids.length)
    throw new AccessError("JEWELRY_SET_PRODUCT_UNAVAILABLE", "productIds");
  return presentProducts(products, access);
}

async function requireRevision(
  tx: Prisma.TransactionClient,
  where: ReturnType<typeof setWhere>,
  revision: number,
) {
  const current = await tx.jewelrySet.findUnique({
    where: { organizationId_storeId_id: where },
    select: {
      id: true,
      name: true,
      revision: true,
      members: { select: { productId: true } },
    },
  });
  if (!current) throw new AccessError("JEWELRY_SET_NOT_FOUND");
  if (current.revision !== revision)
    throw new AccessError("JEWELRY_SET_CHANGED");
  return current;
}

export async function resolveJewelrySetSale(
  tx: Prisma.TransactionClient,
  access: AccessContext,
  selection: SaleJewelrySetSelection,
  productIds: string[],
) {
  const set = await requireRevision(
    tx,
    setWhere(access, selection.id),
    selection.revision,
  );
  const members = new Set(set.members.map(({ productId }) => productId));
  if (
    (selection.mode === "complete" && productIds.length !== members.size) ||
    productIds.some((productId) => !members.has(productId))
  )
    throw new AccessError("JEWELRY_SET_CHANGED", "items");
  const available = await tx.product.count({
    where: { ...scope(access), id: { in: productIds }, ...inStock },
  });
  if (available !== productIds.length)
    throw new AccessError("JEWELRY_SET_PRODUCT_UNAVAILABLE", "items");
  return { id: set.id, name: set.name };
}

export async function saveJewelrySet(
  db: OrganizationDatabase,
  access: AccessContext,
  { name, description, productIds }: JewelrySetInput,
  existing?: { id: string; revision: number },
) {
  try {
    return await db.$transaction(async (tx) => {
      // Individual sales and product deletion use the same organization lock.
      const owner = await lockProductOwner(tx, access);
      const store = scope(owner);
      const where = existing && setWhere(owner, existing.id);
      const current =
        where && existing
          ? (await requireRevision(tx, where, existing.revision)).members
          : [];
      const currentIds = new Set(current.map(({ productId }) => productId));
      const added = productIds.filter((id) => !currentIds.has(id));
      if (added.length) {
        const candidates = await tx.product.findMany({
          where: { ...store, id: { in: added }, ...inStock },
          select: { setMembership: { select: { setId: true } } },
        });
        if (candidates.length !== added.length)
          throw new AccessError(
            "JEWELRY_SET_PRODUCT_UNAVAILABLE",
            "productIds",
          );
        if (candidates.some(({ setMembership }) => setMembership))
          throw new AccessError("JEWELRY_SET_PRODUCT_CONFLICT", "productIds");
      }
      const data = { name, description: description || null };
      const { id } = where
        ? await tx.jewelrySet.update({
            where: { organizationId_storeId_id: where },
            data: { ...data, revision: { increment: 1 } },
          })
        : await tx.jewelrySet.create({ data: { ...store, ...data } });
      const removed = [...currentIds].filter(
        (productId) => !productIds.includes(productId),
      );
      if (removed.length)
        await tx.jewelrySetMember.deleteMany({
          where: { ...store, setId: id, productId: { in: removed } },
        });
      if (added.length)
        await tx.jewelrySetMember.createMany({
          data: added.map((productId) => ({ ...store, setId: id, productId })),
        });
      return readSet(tx, owner, id);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AccessError("JEWELRY_SET_PRODUCT_CONFLICT", "productIds");
    throw error;
  }
}

export async function dissolveJewelrySet(
  db: OrganizationDatabase,
  access: AccessContext,
  id: string,
  revision: number,
) {
  await db.$transaction(async (tx) => {
    const owner = await lockProductOwner(tx, access);
    const where = setWhere(owner, id);
    await requireRevision(tx, where, revision);
    await tx.jewelrySet.delete({ where: { organizationId_storeId_id: where } });
  });
}
