import { Prisma } from "@mizan/database";
import { randomUUID } from "node:crypto";
import { categoryLabel } from "@mizan/contracts";
import type {
  MoneyInput,
  ProductAcquisitionInput,
  ProductCreateInput,
  ProductGemstoneFilter,
  ProductPhotoUpload,
  ProductOverview,
  ProductRegistrationSource,
  ProductStatus,
  RegistrationProduct,
} from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
import { businessDateRange } from "../access/business-date.js";
import { readPageSize } from "../access/page-size.js";
import { canManageAsOwner } from "../access/display-mode.js";
import {
  resolveAccessContext,
  uuidPattern,
  type AccessContext,
} from "../access/access.service.js";
import {
  lockOrganization,
  type OrganizationDatabase,
} from "../access/organization-owner.js";
import {
  canEditAcquisition,
  detailFields,
  listFields,
  presentDetail,
  presentListItem,
} from "./product.presenter.js";
import {
  pagePhotoUrls,
  photoDirectory,
  scopedPhotoKey,
  type ProductPhotoStorage,
} from "./product.storage.js";
import { readGoldMarket } from "../gold-prices/gold-market.service.js";
import {
  currentGoldRules,
  goldExchangeRate,
  goldValue,
  marketPurityRate,
  resolveGoldRate,
} from "../gold-prices/store-pricing.service.js";

export interface ProductOptions {
  db: OrganizationDatabase;
  storage?: ProductPhotoStorage;
}

function scope({ organizationId, storeId }: AccessContext) {
  return { organizationId, storeId };
}

async function findProduct(
  db: Prisma.TransactionClient,
  access: AccessContext,
  id: string,
) {
  if (!uuidPattern.test(id)) throw new AccessError("PRODUCT_NOT_FOUND");
  const product = await db.product.findUnique({
    where: { organizationId_storeId_id: { ...scope(access), id } },
    select: detailFields(access),
  });
  if (!product) throw new AccessError("PRODUCT_NOT_FOUND");
  return product;
}

export async function createProduct(
  db: OrganizationDatabase,
  access: AccessContext,
  input: ProductCreateInput,
  total: MoneyInput,
) {
  const store = scope(access);
  return db.$transaction(async (tx) => {
    // Purity changes use this same lock, so a grade cannot be deactivated during creation.
    await lockOrganization(tx, store.organizationId);
    const currentAccess = await resolveAccessContext(
      tx,
      access,
      store.organizationId,
      store.storeId,
    );
    const { id } = await receiveProduct(tx, currentAccess, input, total);
    return presentDetail(
      await findProduct(tx, currentAccess, id),
      null,
      currentAccess,
    );
  });
}

// The caller holds the organization lock and has resolved current store access.
export async function receiveProduct(
  tx: Prisma.TransactionClient,
  access: AccessContext,
  input: ProductCreateInput,
  total: MoneyInput,
) {
  const [id] = await receiveProducts(tx, access, [{ product: input, total }]);
  return { id };
}

// All intake paths share these checks. The organization lock also protects code
// uniqueness and category/purity changes across stores in the organization.
export async function receiveProducts(
  tx: Prisma.TransactionClient,
  access: AccessContext,
  items: RegistrationProduct[],
  source?: ProductRegistrationSource,
  historicalSupplier?: { id: string; name: string },
  rowField?: (index: number, field: string) => string,
) {
  const store = scope(access);
  const grades = await tx.purityGrade.findMany({
    where: {
      organizationId: store.organizationId,
      active: true,
      value: { in: items.map(({ product }) => product.purity) },
    },
    select: { value: true },
  });
  const categories = await tx.productCategory.findMany({
    where: {
      organizationId: store.organizationId,
      isActive: true,
      ...(items.every(({ product }) => product.categoryId) && {
        id: { in: items.map(({ product }) => product.categoryId!) },
      }),
    },
    select: { id: true, name: true, code: true },
  });
  const existing = await tx.product.findMany({
    where: {
      organizationId: store.organizationId,
      code: { in: items.map(({ product }) => product.code) },
    },
    select: { code: true },
  });
  const activeGrades = new Set(grades.map(({ value }) => value));
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const usedCodes = new Set(existing.map(({ code }) => code));
  const gemstoneRows: Prisma.ProductGemstoneCreateManyInput[] = [];
  const rows = items.map(({ product, total }, index) => {
    const { code, name, purity, metalType, note, gemstones } = product;
    const field = (name: string) => rowField?.(index, name) ?? name;
    if (!activeGrades.has(purity))
      throw new AccessError("PURITY_CONFLICT", field("purity"));
    const category = product.categoryId
      ? categoriesById.get(product.categoryId.toLowerCase())
      : categoryByLabel(categories, product.category);
    if (!category)
      throw new AccessError("CATEGORY_UNAVAILABLE", field("categoryId"));
    if (usedCodes.has(code))
      throw new AccessError("PRODUCT_CODE_CONFLICT", field("code"));
    usedCodes.add(code);
    const id = randomUUID();
    gemstones?.forEach((group, position) => {
      gemstoneRows.push({ ...store, ...group, productId: id, position });
    });
    return {
      ...store,
      id,
      code,
      name,
      category: product.category ?? category.name,
      categoryId: category.id,
      purity,
      metalType,
      note,
      ...acquisitionData(product, total),
      historicalSupplierId: historicalSupplier?.id,
      historicalSupplierName: historicalSupplier?.name,
    };
  });
  try {
    await tx.product.createMany({ data: rows });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AccessError(
        "PRODUCT_CODE_CONFLICT",
        rows.length === 1 ? (rowField?.(0, "code") ?? "code") : undefined,
      );
    }
    throw error;
  }
  if (gemstoneRows.length)
    await tx.productGemstone.createMany({ data: gemstoneRows });
  await tx.inventoryMovement.createMany({
    data: rows.map(({ id }) => ({
      ...store,
      productId: id,
      actorId: access.userId,
      kind: "PRODUCT_ADDED",
      registrationSource: source,
    })),
  });
  return rows.map(({ id }) => id);
}

function categoryByLabel(
  rows: { id: string; name: string; code: string | null }[],
  label: string | undefined,
) {
  if (!label) return;
  const folded = label.toLowerCase();
  return (
    rows.find(({ name }) => name.toLowerCase() === folded) ??
    rows.find((candidate) =>
      ["en", "ru"].some(
        (locale) => categoryLabel(candidate, locale).toLowerCase() === folded,
      ),
    )
  );
}

async function activeCategory(
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: { categoryId?: string; category?: string },
) {
  const { categoryId } = input;
  if (categoryId) {
    const row = await tx.productCategory.findFirst({
      where: { organizationId, id: categoryId, isActive: true },
      select: { id: true, name: true },
    });
    if (row) return row;
  }
  throw new AccessError("CATEGORY_UNAVAILABLE", "categoryId");
}

function acquisitionData(input: ProductAcquisitionInput, total: MoneyInput) {
  const parts = input.acquisitionBreakdown;
  const fixed = input.fixedSellingPrice;
  return {
    weight: input.weight,
    netGoldWeight: input.netGoldWeight,
    acquisitionCost: total.amount,
    acquisitionCostPerGram: input.acquisitionCostPerGram?.amount ?? null,
    acquisitionCurrency: total.currency,
    acquisitionMetal: parts?.metal ?? null,
    acquisitionGemstones: parts?.gemstones ?? null,
    acquisitionWorkmanship: parts?.workmanship ?? null,
    acquisitionOther: parts?.other ?? null,
    ...(fixed !== undefined && {
      fixedSellingAmount: fixed?.amount ?? null,
      fixedSellingCurrency: fixed?.currency ?? null,
    }),
  };
}

async function lockProductOwner(
  tx: Prisma.TransactionClient,
  access: AccessContext,
) {
  if (!canManageAsOwner(access)) throw new AccessError("ACCESS_DENIED");
  await lockOrganization(tx, access.organizationId);
  const currentAccess = await resolveAccessContext(
    tx,
    access,
    access.organizationId,
    access.storeId,
  );
  if (!canManageAsOwner(currentAccess)) throw new AccessError("ACCESS_DENIED");
  return currentAccess;
}

export async function updateProductAcquisition(
  db: OrganizationDatabase,
  access: AccessContext,
  id: string,
  input: ProductAcquisitionInput,
  total: MoneyInput,
  categoryId?: string,
) {
  await db.$transaction(async (tx) => {
    const currentAccess = await lockProductOwner(tx, access);
    const row = await findProduct(tx, currentAccess, id);
    if (!canEditAcquisition(row))
      throw new AccessError("PRODUCT_EDIT_CONFLICT");
    const category =
      categoryId && categoryId !== row.productCategory?.id
        ? await activeCategory(tx, currentAccess.organizationId, { categoryId })
        : undefined;
    if (row.gemstones.length && !input.acquisitionCost)
      throw new AccessError("INVALID_PRODUCT", "acquisitionCost");
    if (
      input.netGoldWeight === undefined &&
      row.netGoldWeight?.gt(input.weight)
    )
      throw new AccessError("INVALID_PRODUCT", "netGoldWeight");
    await tx.product.update({
      where: {
        organizationId_storeId_id: { ...scope(currentAccess), id: row.id },
      },
      data: {
        ...acquisitionData(input, total),
        ...(category && { category: category.name, categoryId: category.id }),
      },
    });
  });
}

export async function deleteProduct(
  db: OrganizationDatabase,
  access: AccessContext,
  id: string,
) {
  try {
    await db.$transaction(async (tx) => {
      const currentAccess = await lockProductOwner(tx, access);
      if (!uuidPattern.test(id)) throw new AccessError("PRODUCT_NOT_FOUND");
      const where = { ...scope(currentAccess), id };
      const { count } = await tx.product.deleteMany({
        where: {
          ...where,
          status: "IN_STOCK",
          sale: null,
          saleItem: null,
          purchaseItem: null,
          historicalSupplierId: null,
          movements: { none: {} },
        },
      });
      if (count) return;
      const existing = await tx.product.findUnique({
        where: { organizationId_storeId_id: where },
        select: { id: true },
      });
      throw new AccessError(
        existing ? "PRODUCT_DELETE_CONFLICT" : "PRODUCT_NOT_FOUND",
      );
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    )
      throw new AccessError("PRODUCT_DELETE_CONFLICT");
    throw error;
  }
}

const creditSale = { outstandingDebt: { gt: 0 } } as const;
const soldOnCredit: Prisma.ProductWhereInput = {
  status: "SOLD",
  OR: [{ saleItem: { sale: creditSale } }, { sale: creditSale }],
};

export async function getProductOverview(
  db: OrganizationDatabase,
  access: AccessContext,
): Promise<ProductOverview> {
  const store = scope(access);
  const available = { ...store, status: "IN_STOCK" as const };
  const owner = canManageAsOwner(access);
  return db.$transaction(
    async (tx) => {
      const counts = await tx.product.groupBy({
        by: ["status"],
        where: store,
        _count: { _all: true },
        _sum: { weight: true },
      });
      const credit = await tx.product.count({
        where: { ...store, ...soldOnCredit },
      });
      const costs = owner
        ? await tx.product.groupBy({
            by: ["acquisitionCurrency"],
            where: available,
            _sum: { acquisitionCost: true },
            orderBy: { acquisitionCurrency: "asc" },
          })
        : undefined;
      const stock = counts.find(({ status }) => status === "IN_STOCK");
      return {
        available: stock?._count._all ?? 0,
        sold: counts.find(({ status }) => status === "SOLD")?._count._all ?? 0,
        soldOnCredit: credit,
        availableWeight: stock?._sum.weight?.toFixed() ?? "0",
        ...(costs && {
          acquisitionValue: costs.flatMap(({ acquisitionCurrency, _sum }) =>
            _sum.acquisitionCost
              ? [
                  {
                    currency: acquisitionCurrency,
                    amount: _sum.acquisitionCost.toFixed(),
                  },
                ]
              : [],
          ),
        }),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function listProducts(
  { db, storage }: ProductOptions,
  access: AccessContext,
  filters: {
    q?: string;
    status?: ProductStatus;
    after?: string;
    category?: string;
    categoryId?: string;
    purity?: number;
    gemstones?: ProductGemstoneFilter;
    facets?: boolean;
    soldOn?: string;
    receivedOn?: string;
    agedDays?: number;
    credit?: boolean;
    limit?: string;
    photos?: boolean;
    unpurchased?: boolean;
    purchaseCurrency?: string;
  },
) {
  const pageSize = readPageSize(filters.limit, "INVALID_PRODUCT");
  const search = filters.q?.replace(/[\\%_]/g, "\\$&");
  const soldOn = businessDateRange(filters.soldOn, "INVALID_PRODUCT", "soldOn");
  const receivedOn = businessDateRange(
    filters.receivedOn,
    "INVALID_PRODUCT",
    "receivedOn",
  );
  const agedBefore =
    filters.agedDays === undefined
      ? undefined
      : new Date(Date.now() - filters.agedDays * 86_400_000);
  const rows = await db.product.findMany({
    where: {
      ...scope(access),
      status: filters.credit ? "SOLD" : filters.status,
      category: filters.category,
      categoryId: filters.categoryId,
      purity: filters.purity,
      purchaseItem: filters.unpurchased ? null : undefined,
      acquisitionCurrency: filters.purchaseCurrency,
      acquisitionCost: filters.unpurchased ? { gt: 0 } : undefined,
      gemstones:
        filters.gemstones === "recorded"
          ? { some: {} }
          : filters.gemstones === "none"
            ? { none: {} }
            : undefined,
      code: filters.after === undefined ? undefined : { gt: filters.after },
      AND: [
        ...(filters.credit ? [soldOnCredit] : []),
        ...(soldOn
          ? [
              {
                OR: [
                  { saleItem: { sale: { createdAt: soldOn } } },
                  { sale: { createdAt: soldOn } },
                ],
              },
            ]
          : []),
        ...(receivedOn
          ? [
              {
                movements: {
                  some: {
                    kind: "PRODUCT_ADDED" as const,
                    createdAt: receivedOn,
                  },
                },
              },
              {
                movements: {
                  none: {
                    kind: "PRODUCT_ADDED" as const,
                    createdAt: { lt: receivedOn.gte },
                  },
                },
              },
            ]
          : []),
        ...(agedBefore
          ? [
              {
                movements: {
                  some: {
                    kind: "PRODUCT_ADDED" as const,
                    createdAt: { lte: agedBefore },
                  },
                },
              },
            ]
          : []),
      ],
      OR: search
        ? [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { code: "asc" },
    take: pageSize + 1,
    select: {
      ...listFields,
      photoObjectKey: Boolean(filters.photos && storage),
    },
  });
  const page = rows.slice(0, pageSize);
  const photos = await pagePhotoUrls(
    filters.photos ? storage : undefined,
    access,
    page,
  );
  const items = page.map((row) => {
    const thumbnailUrl = photos.get(row.id);
    return { ...presentListItem(row), ...(thumbnailUrl && { thumbnailUrl }) };
  });
  const facets = filters.facets
    ? await Promise.all([
        db.product.groupBy({
          by: ["category"],
          where: scope(access),
          orderBy: { category: "asc" },
        }),
        db.product.groupBy({
          by: ["purity"],
          where: scope(access),
          orderBy: { purity: "asc" },
        }),
      ])
    : undefined;
  return {
    items,
    ...(facets && {
      filters: {
        categories: facets[0].map((row) => row.category),
        purities: facets[1].map((row) => row.purity),
      },
    }),
    ...(rows.length > pageSize && { nextCursor: items[pageSize - 1].code }),
  };
}

export async function getProduct(
  options: ProductOptions,
  access: AccessContext,
  id: string,
) {
  const row = await findProduct(options.db, access, id);
  const key = scopedPhotoKey(access, row.id, row.photoObjectKey);
  let photoUrl = null;
  if (
    key &&
    row.photoContentType &&
    row.photoSize !== null &&
    options.storage
  ) {
    try {
      photoUrl = await options.storage.signDownload(key);
    } catch (error) {
      if (!(error instanceof AccessError && error.code === "PHOTO_UNAVAILABLE"))
        throw error;
      // Inventory detail stays usable during a storage outage.
    }
  }
  const detail = presentDetail(row, photoUrl, access);
  if (
    row.status !== "IN_STOCK" ||
    row.metalType !== "GOLD" ||
    !row.netGoldWeight
  )
    return detail;
  const [market, rules] = await Promise.all([
    readGoldMarket(options.db),
    row.grade.active
      ? currentGoldRules(options.db, access, ["RETAIL_SELL"], [row.purity])
      : [],
  ]);
  const quote = market.stale ? null : market.quote;
  const material = goldValue(
    marketPurityRate(quote, row.purity),
    row.netGoldWeight,
  );
  const currency = access.settings.defaultCurrency;
  const sellingRate = row.grade.active
    ? resolveGoldRate(rules, "RETAIL_SELL", row.purity, market).rate
    : null;
  const aznPerUnit =
    sellingRate && (await goldExchangeRate(options.db, currency));
  const selling =
    aznPerUnit &&
    goldValue(sellingRate, row.netGoldWeight, currency, aznPerUnit);
  const metalOnly =
    row.gemstones.length > 0 || Boolean(detail.fixedSellingPrice);
  return {
    ...detail,
    ...(material && { estimatedMaterialValue: material }),
    ...(selling &&
      (metalOnly
        ? { estimatedMetalSellingValue: selling }
        : { estimatedSellingValue: selling })),
  };
}

function photoStorage(options: ProductOptions) {
  if (!options.storage) throw new AccessError("PHOTO_UNAVAILABLE");
  return options.storage;
}

export async function startPhotoUpload(
  options: ProductOptions,
  access: AccessContext,
  id: string,
): Promise<ProductPhotoUpload> {
  const row = await findProduct(options.db, access, id);
  if (row.photoObjectKey) throw new AccessError("PHOTO_CONFLICT");
  const uploadId = randomUUID();
  const uploadUrl = await photoStorage(options).signUpload(
    photoDirectory(access, row.id) + uploadId,
  );
  return { uploadId, uploadUrl };
}

const photoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoSize = 5 * 1024 * 1024;

export async function confirmPhoto(
  options: ProductOptions,
  access: AccessContext,
  id: string,
  uploadId: string,
) {
  const row = await findProduct(options.db, access, id);
  const key = photoDirectory(access, row.id) + uploadId.toLowerCase();
  if (row.photoObjectKey && row.photoObjectKey !== key)
    throw new AccessError("PHOTO_CONFLICT");
  const store = scope(access);
  if (!row.photoObjectKey) {
    const metadata = await photoStorage(options).inspect(key);
    if (
      !metadata ||
      !photoTypes.has(metadata.contentType) ||
      !Number.isSafeInteger(metadata.size) ||
      metadata.size <= 0 ||
      metadata.size > maxPhotoSize
    )
      throw new AccessError("PHOTO_CONFLICT");
    access = await options.db.$transaction(async (tx) => {
      await lockOrganization(tx, store.organizationId);
      const currentAccess = await resolveAccessContext(
        tx,
        access,
        store.organizationId,
        store.storeId,
      );
      const { count } = await tx.product.updateMany({
        where: { ...store, id: row.id, photoObjectKey: null },
        data: {
          photoObjectKey: key,
          photoContentType: metadata.contentType,
          photoSize: metadata.size,
        },
      });
      if (
        count === 0 &&
        (await findProduct(tx, currentAccess, row.id)).photoObjectKey !== key
      )
        throw new AccessError("PHOTO_CONFLICT");
      return currentAccess;
    });
  }
  return getProduct(options, access, id);
}
