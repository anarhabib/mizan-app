import {
  maxCategorySortOrder,
  parseCategoryName,
  type ProductCategory,
} from "@mizan/contracts";
import type { Prisma } from "@mizan/database";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../plugins/auth.js";
import type { AccessOptions } from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import { uuidPattern } from "../access/access.service.js";
import { requireOwnerDisplay } from "../access/display-mode.js";
import {
  ownerChange,
  type OrganizationDatabase,
} from "../access/organization-owner.js";

const path = "/organizations/:organizationId/product-categories";
const select = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  sortOrder: true,
} as const;

type CategoryRoute = { Params: { organizationId: string } };
type CategoryEdit = CategoryRoute & { Params: { id: string } };

async function checkName(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
  id?: string,
) {
  const matches = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "mizan"."ProductCategory"
    WHERE "organizationId" = ${organizationId}::uuid AND lower(name) = lower(${name})
  `;
  if (matches.some((match) => match.id !== id))
    throw new AccessError("CATEGORY_CONFLICT", "name");
}

export function registerCategoryRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
  db?: OrganizationDatabase,
) {
  const preHandler =
    access && db
      ? authenticate(access.db, access.verifyToken)
      : async () => {
          throw new AccessError("AUTH_UNAVAILABLE");
        };

  app.get<CategoryRoute & { Querystring: { all?: string } }>(
    path,
    { preHandler },
    async (request): Promise<ProductCategory[]> => {
      const { organizationId } = request.params;
      const { userId, salespersonDisplay } = request.identity!;
      if (!uuidPattern.test(organizationId))
        throw new AccessError("ACCESS_DENIED");
      const membership = await db!.organizationMembership.findFirst({
        where: { organizationId, userId, active: true },
        select: { role: true },
      });
      const all = request.query.all === "1";
      if (
        !membership ||
        (all && (membership.role !== "OWNER" || salespersonDisplay))
      )
        throw new AccessError("ACCESS_DENIED");
      return db!.productCategory.findMany({
        where: { organizationId, ...(!all && { isActive: true }) },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        select,
      });
    },
  );

  app.post<CategoryRoute & { Body: { name?: unknown } | null }>(
    path,
    { preHandler: [preHandler, requireOwnerDisplay] },
    async (request, reply) => {
      const { organizationId } = request.params;
      const category = await ownerChange(
        db!,
        organizationId,
        request.identity!.userId,
        async (tx) => {
          const name = parseCategoryName(request.body?.name);
          if (!name || Object.keys(request.body ?? {}).length !== 1)
            throw new AccessError("INVALID_CATEGORY", "name");
          await checkName(tx, organizationId, name);
          const last = await tx.productCategory.aggregate({
            where: { organizationId },
            _max: { sortOrder: true },
          });
          return tx.productCategory.create({
            data: {
              organizationId,
              name,
              sortOrder: Math.min(
                maxCategorySortOrder,
                (last._max.sortOrder ?? -1) + 1,
              ),
            },
            select,
          });
        },
      );
      return reply.code(201).send(category);
    },
  );

  app.patch<CategoryEdit & { Body: Record<string, unknown> | null }>(
    `${path}/:id`,
    { preHandler: [preHandler, requireOwnerDisplay] },
    (request) => {
      const { organizationId, id } = request.params;
      return ownerChange(
        db!,
        organizationId,
        request.identity!.userId,
        async (tx) => {
          const body = request.body;
          const keys = Object.keys(body ?? {});
          if (
            !body ||
            !keys.length ||
            keys.some((key) => !["name", "isActive", "sortOrder"].includes(key))
          )
            throw new AccessError("INVALID_CATEGORY");
          const data: {
            name?: string;
            isActive?: boolean;
            sortOrder?: number;
          } = {};
          if ("name" in body) {
            const name = parseCategoryName(body.name);
            if (!name) throw new AccessError("INVALID_CATEGORY", "name");
            data.name = name;
          }
          if ("isActive" in body) {
            if (typeof body.isActive !== "boolean")
              throw new AccessError("INVALID_CATEGORY", "isActive");
            data.isActive = body.isActive;
          }
          if ("sortOrder" in body) {
            const { sortOrder } = body;
            if (
              typeof sortOrder !== "number" ||
              !Number.isInteger(sortOrder) ||
              sortOrder < 0 ||
              sortOrder > maxCategorySortOrder
            )
              throw new AccessError("INVALID_CATEGORY", "sortOrder");
            data.sortOrder = sortOrder;
          }
          const where = { organizationId_id: { organizationId, id } };
          if (!uuidPattern.test(id))
            throw new AccessError("CATEGORY_UNAVAILABLE");
          const current = await tx.productCategory.findUnique({
            where,
            select: { sortOrder: true },
          });
          if (!current) throw new AccessError("CATEGORY_UNAVAILABLE");
          if (data.name !== undefined)
            await checkName(tx, organizationId, data.name, id);
          if (
            data.sortOrder !== undefined &&
            data.sortOrder !== current.sortOrder
          ) {
            const last = await tx.productCategory.aggregate({
              where: { organizationId },
              _max: { sortOrder: true },
            });
            const target = Math.min(data.sortOrder, last._max.sortOrder ?? 0);
            if (target !== current.sortOrder) {
              const earlier = target < current.sortOrder;
              await tx.productCategory.updateMany({
                where: {
                  organizationId,
                  sortOrder: earlier
                    ? { gte: target, lt: current.sortOrder }
                    : { gt: current.sortOrder, lte: target },
                },
                data: { sortOrder: { increment: earlier ? 1 : -1 } },
              });
            }
            data.sortOrder = target;
          }
          return tx.productCategory.update({ where, data, select });
        },
      );
    },
  );
}
