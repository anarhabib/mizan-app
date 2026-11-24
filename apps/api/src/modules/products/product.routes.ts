import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  isSupplierCurrency,
  parseProductAcquisition,
  parseProductCreate,
} from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
import { canManageAsOwner } from "../access/display-mode.js";
import { resolveAccessContext, uuidPattern } from "../access/access.service.js";
import { authenticate } from "../../plugins/auth.js";
import type { AccessOptions } from "../../plugins/request-context.js";
import {
  confirmPhoto,
  createProduct,
  deleteProduct,
  getProduct,
  getProductOverview,
  listProducts,
  startPhotoUpload,
  updateProductAcquisition,
  type ProductOptions,
} from "./product.service.js";

type Query = {
  organizationId?: string;
  storeId?: string;
  q?: string;
  status?: string;
  after?: string;
  category?: string;
  categoryId?: string;
  purity?: string;
  gemstones?: string;
  facets?: string;
  photos?: string;
  soldOn?: string;
  receivedOn?: string;
  agedDays?: string;
  credit?: string;
  limit?: string;
  unpurchased?: string;
  purchaseCurrency?: string;
};
type ProductQuery = { Querystring: Query };
type ProductId = ProductQuery & { Params: { id: string } };

export function registerProductRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
  products?: ProductOptions,
) {
  function options() {
    if (!products) throw new AccessError("AUTH_UNAVAILABLE");
    return products;
  }

  const preHandler =
    access && products
      ? [
          authenticate(access.db, access.verifyToken),
          async (request: FastifyRequest<ProductQuery>) => {
            const { organizationId, storeId } = request.query;
            if (
              typeof organizationId !== "string" ||
              typeof storeId !== "string"
            )
              throw new AccessError("ACCESS_DENIED");
            if (!request.identity) throw new AccessError("UNAUTHENTICATED");
            request.access = await resolveAccessContext(
              access.db,
              request.identity,
              organizationId,
              storeId,
            );
          },
        ]
      : async () => {
          throw new AccessError("AUTH_UNAVAILABLE");
        };

  app.post<ProductQuery>(
    "/products",
    { preHandler },
    async (request, reply) => {
      const parsed = parseProductCreate(request.body);
      if ("field" in parsed)
        throw new AccessError("INVALID_PRODUCT", parsed.field);
      const detail = await createProduct(
        options().db,
        request.access!,
        parsed.input,
        parsed.total,
      );
      return reply.code(201).send(detail);
    },
  );
  app.get<ProductQuery>("/products", { preHandler }, (request) => {
    const {
      q,
      status,
      after,
      category,
      categoryId,
      purity,
      gemstones,
      facets,
      soldOn,
      receivedOn,
      agedDays,
      credit,
      limit,
      unpurchased,
      purchaseCurrency,
    } = request.query;
    if (unpurchased !== undefined) {
      if (unpurchased !== "true")
        throw new AccessError("INVALID_PRODUCT", "unpurchased");
      if (!canManageAsOwner(request.access!))
        throw new AccessError("ACCESS_DENIED");
    }
    if (
      purchaseCurrency !== undefined &&
      (unpurchased !== "true" || !isSupplierCurrency(purchaseCurrency))
    )
      throw new AccessError("INVALID_PRODUCT", "purchaseCurrency");
    if (
      agedDays !== undefined &&
      (typeof agedDays !== "string" ||
        !/^[1-9]\d{0,2}$/.test(agedDays) ||
        +agedDays > 365)
    )
      throw new AccessError("INVALID_PRODUCT", "agedDays");
    if (
      categoryId !== undefined &&
      (typeof categoryId !== "string" ||
        !uuidPattern.test(categoryId) ||
        category !== undefined)
    )
      throw new AccessError("INVALID_PRODUCT", "categoryId");
    if (
      category !== undefined &&
      (typeof category !== "string" ||
        category.length > 80 ||
        category.includes("\0"))
    )
      throw new AccessError("INVALID_PRODUCT", "category");
    if (
      purity !== undefined &&
      (typeof purity !== "string" || !/^[1-9]\d{0,2}$/.test(purity))
    )
      throw new AccessError("INVALID_PRODUCT", "purity");
    if (
      gemstones !== undefined &&
      gemstones !== "recorded" &&
      gemstones !== "none"
    )
      throw new AccessError("INVALID_PRODUCT", "gemstones");
    if (
      q !== undefined &&
      (typeof q !== "string" || q.length > 160 || q.includes("\0"))
    )
      throw new AccessError("INVALID_PRODUCT", "q");
    if (status !== undefined && status !== "IN_STOCK" && status !== "SOLD")
      throw new AccessError("INVALID_PRODUCT", "status");
    if (credit !== undefined && (credit !== "true" || status === "IN_STOCK"))
      throw new AccessError("INVALID_PRODUCT", "credit");
    if (
      after !== undefined &&
      (typeof after !== "string" ||
        !after.length ||
        after.length > 80 ||
        after.includes("\0"))
    )
      throw new AccessError("INVALID_PRODUCT", "after");
    return listProducts(options(), request.access!, {
      unpurchased: unpurchased === "true",
      purchaseCurrency,
      photos: request.query.photos === "1",
      q: q?.trim(),
      status,
      after,
      category,
      categoryId,
      purity: purity === undefined ? undefined : Number(purity),
      gemstones,
      facets: facets === "1",
      soldOn,
      receivedOn,
      agedDays: agedDays === undefined ? undefined : +agedDays,
      credit: credit === "true",
      limit,
    });
  });
  app.get<ProductQuery>("/products/overview", { preHandler }, (request) =>
    getProductOverview(options().db, request.access!),
  );
  app.get<ProductQuery>(
    "/products/options",
    { preHandler },
    async (request) => {
      const access = request.access!;
      const grades = await options().db.purityGrade.findMany({
        where: { organizationId: access.organizationId, active: true },
        orderBy: { value: "asc" },
        select: { value: true },
      });
      return {
        defaultCurrency: access.settings.defaultCurrency,
        purities: grades.map(({ value }) => value),
      };
    },
  );
  app.get<ProductId>("/products/:id", { preHandler }, (request) =>
    getProduct(options(), request.access!, request.params.id),
  );
  app.patch<ProductId & { Body: { categoryId?: unknown } | null }>(
    "/products/:id/acquisition",
    { preHandler },
    async (request, reply) => {
      if (!canManageAsOwner(request.access!))
        throw new AccessError("ACCESS_DENIED");
      const parsed = parseProductAcquisition(request.body);
      if ("field" in parsed)
        throw new AccessError("INVALID_PRODUCT", parsed.field);
      const categoryId = request.body?.categoryId;
      if (
        categoryId !== undefined &&
        (typeof categoryId !== "string" || !uuidPattern.test(categoryId))
      )
        throw new AccessError("INVALID_PRODUCT", "categoryId");
      await updateProductAcquisition(
        options().db,
        request.access!,
        request.params.id,
        parsed.input,
        parsed.total,
        categoryId,
      );
      return reply.code(204).send();
    },
  );
  app.delete<ProductId>(
    "/products/:id",
    { preHandler },
    async (request, reply) => {
      await deleteProduct(options().db, request.access!, request.params.id);
      return reply.code(204).send();
    },
  );
  app.post<ProductId>("/products/:id/photo-upload", { preHandler }, (request) =>
    startPhotoUpload(options(), request.access!, request.params.id),
  );
  app.post<ProductId & { Body: { uploadId?: unknown } | null }>(
    "/products/:id/photo-confirm",
    { preHandler },
    (request) => {
      if (
        typeof request.body?.uploadId !== "string" ||
        !uuidPattern.test(request.body.uploadId) ||
        Object.keys(request.body).length !== 1
      )
        throw new AccessError("INVALID_PRODUCT");
      return confirmPhoto(
        options(),
        request.access!,
        request.params.id,
        request.body.uploadId,
      );
    },
  );
}
