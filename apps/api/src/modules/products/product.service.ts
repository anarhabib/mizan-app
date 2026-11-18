import { Prisma } from "@mizan/database";
import { randomUUID } from "node:crypto";
import type {
  ProductCreateInput,
  ProductPhotoUpload,
  ProductStatus,
} from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
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
  detailFields,
  listFields,
  presentDetail,
  presentListItem,
} from "./product.presenter.js";
import type { ProductPhotoStorage } from "./product.storage.js";

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
) {
  const { acquisitionCost, ...values } = input;
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
          acquisitionCost: acquisitionCost.amount,
          acquisitionCurrency: acquisitionCost.currency,
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

const pageSize = 50;

export async function listProducts(
  db: OrganizationDatabase,
  access: AccessContext,
  filters: { q?: string; status?: ProductStatus; after?: string },
) {
  const search = filters.q?.replace(/[\\%_]/g, "\\$&");
  const rows = await db.product.findMany({
    where: {
      ...scope(access),
      status: filters.status,
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
  return {
    items,
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
  return presentDetail(row, photoUrl);
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
