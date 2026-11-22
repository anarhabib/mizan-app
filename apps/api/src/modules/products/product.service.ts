import { Prisma } from "@mizan/database";
import { randomUUID } from "node:crypto";
import { officialRateCurrencies } from "@mizan/contracts";
import type {
  MoneyInput,
  ProductAcquisitionInput,
  ProductCreateInput,
  ProductPhotoUpload,
  ProductStatus,
} from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
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
import type { ProductPhotoStorage } from "./product.storage.js";
import { readGoldMarket } from "../gold-prices/gold-market.service.js";
import { presentExchangeRates } from "../exchange-rates/exchange-rates.service.js";
import {
  currentGoldRules,
  effectiveGoldRate,
  goldValue,
  marketPurityRate,
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
  const { acquisitionCostPerGram, ...values } = input;
  const store = scope(access);
  try {
    return await db.$transaction(async (tx) => {
      // Purity changes use this same lock, so a grade cannot be deactivated during creation.
      await lockOrganization(tx, store.organizationId);
      const currentAccess = await resolveAccessContext(
        tx,
        access,
        store.organizationId,
        store.storeId,
      );
      const grade = await tx.purityGrade.findUnique({
        where: {
          organizationId_value: {
            organizationId: store.organizationId,
            value: values.purity,
          },
        },
        select: { active: true },
      });
      if (!grade?.active) throw new AccessError("PURITY_CONFLICT", "purity");
      const product = await tx.product.create({
        data: {
          ...store,
          ...values,
          acquisitionCost: total.amount,
          acquisitionCostPerGram: acquisitionCostPerGram.amount,
          acquisitionCurrency: acquisitionCostPerGram.currency,
        },
        select: { id: true },
      });
      await tx.inventoryMovement.create({
        data: {
          ...store,
          productId: product.id,
          actorId: currentAccess.userId,
          kind: "PRODUCT_ADDED",
        },
      });
      return presentDetail(
        await findProduct(tx, currentAccess, product.id),
        null,
        currentAccess,
      );
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AccessError("PRODUCT_CODE_CONFLICT", "code");
    }
    throw error;
  }
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
) {
  await db.$transaction(async (tx) => {
    const currentAccess = await lockProductOwner(tx, access);
    const row = await findProduct(tx, currentAccess, id);
    if (!canEditAcquisition(row))
      throw new AccessError("PRODUCT_EDIT_CONFLICT");
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
        weight: input.weight,
        netGoldWeight: input.netGoldWeight,
        acquisitionCost: total.amount,
        acquisitionCostPerGram: input.acquisitionCostPerGram.amount,
        acquisitionCurrency: input.acquisitionCostPerGram.currency,
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

const pageSize = 50;

export async function listProducts(
  db: OrganizationDatabase,
  access: AccessContext,
  filters: {
    q?: string;
    status?: ProductStatus;
    after?: string;
    category?: string;
    purity?: number;
    facets?: boolean;
  },
) {
  const search = filters.q?.replace(/[\\%_]/g, "\\$&");
  const rows = await db.product.findMany({
    where: {
      ...scope(access),
      status: filters.status,
      category: filters.category,
      purity: filters.purity,
      code: filters.after === undefined ? undefined : { gt: filters.after },
      OR: search
        ? [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { code: "asc" },
    take: pageSize + 1,
    select: listFields,
  });
  const items = rows.slice(0, pageSize).map(presentListItem);
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
  const directory = photoDirectory(access, row.id);
  let photoUrl = null;
  if (
    row.photoObjectKey?.startsWith(directory) &&
    uuidPattern.test(row.photoObjectKey.slice(directory.length)) &&
    row.photoContentType &&
    row.photoSize !== null &&
    options.storage
  ) {
    try {
      photoUrl = await options.storage.signDownload(row.photoObjectKey);
    } catch (error) {
      if (!(error instanceof AccessError && error.code === "PHOTO_UNAVAILABLE"))
        throw error;
      // Inventory detail stays usable during a storage outage.
    }
  }
  const detail = presentDetail(row, photoUrl, access);
  if (row.status !== "IN_STOCK" || !row.netGoldWeight) return detail;
  const [market, [rule]] = await Promise.all([
    readGoldMarket(options.db),
    currentGoldRules(options.db, access, "SELL", [row.purity]),
  ]);
  const quote = market.stale ? null : market.quote;
  const material = goldValue(
    marketPurityRate(quote, row.purity),
    row.netGoldWeight,
  );
  const currency = access.settings.defaultCurrency;
  const sellingRate = rule
    ? effectiveGoldRate(rule, quote)
    : row.grade.active
      ? marketPurityRate(quote, row.purity)
      : null;
  const official = officialRateCurrencies.find((code) => code === currency);
  const exchange =
    sellingRate &&
    official &&
    presentExchangeRates(
      await options.db.officialExchangeRateSnapshot.findUnique({
        where: { source: "CBAR" },
      }),
      new Date(),
    );
  const aznPerUnit =
    currency === "AZN"
      ? "1"
      : official && exchange && !exchange.stale
        ? exchange.snapshot?.rates[official]
        : undefined;
  const selling =
    aznPerUnit &&
    goldValue(sellingRate, row.netGoldWeight, currency, aznPerUnit);
  return {
    ...detail,
    ...(material && { estimatedMaterialValue: material }),
    ...(selling && { estimatedSellingValue: selling }),
  };
}

function photoDirectory(access: AccessContext, id: string) {
  return [
    access.organizationId,
    access.storeId,
    id.toLowerCase(),
    "photo",
    "",
  ].join("/");
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
