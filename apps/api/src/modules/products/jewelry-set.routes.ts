import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  parseJewelrySetInput,
  parseJewelrySetProductIds,
} from "@mizan/contracts";
import { authenticate } from "../../plugins/auth.js";
import {
  requireStoreAccess,
  type AccessOptions,
} from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import { canManageAsOwner } from "../access/display-mode.js";
import type { OrganizationDatabase } from "../access/organization-owner.js";
import {
  dissolveJewelrySet,
  getJewelrySet,
  listJewelrySets,
  previewJewelrySet,
  saveJewelrySet,
} from "./jewelry-set.service.js";

type Scope = { Params: { organizationId: string; storeId: string } };
type SetById = { Params: Scope["Params"] & { id: string } };
type List = {
  Querystring: {
    q?: string;
    after?: string;
    limit?: string;
    availability?: string;
  };
};

function readInput(body: unknown) {
  const parsed = parseJewelrySetInput(body);
  if ("field" in parsed)
    throw new AccessError("INVALID_JEWELRY_SET", parsed.field);
  return parsed.input;
}

function readRevision(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{0,9}$/.test(value) ||
    +value > 2147483647
  )
    throw new AccessError("INVALID_JEWELRY_SET", "revision");
  return +value;
}

export function registerJewelrySetRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
  db?: OrganizationDatabase,
) {
  const preHandler =
    access && db
      ? [
          authenticate(access.db, access.verifyToken),
          requireStoreAccess(access.db),
        ]
      : async () => {
          throw new AccessError("AUTH_UNAVAILABLE");
        };
  const path = "/organizations/:organizationId/stores/:storeId/jewelry-sets";
  const owner = [
    ...(Array.isArray(preHandler) ? preHandler : [preHandler]),
    async (request: FastifyRequest) => {
      if (!request.access || !canManageAsOwner(request.access))
        throw new AccessError("ACCESS_DENIED");
    },
  ];

  app.get<Scope & List>(path, { preHandler }, (request) =>
    listJewelrySets(db!, request.access!, request.query),
  );
  app.get<SetById>(`${path}/:id`, { preHandler }, (request) =>
    getJewelrySet(db!, request.access!, request.params.id),
  );
  app.post<Scope & { Body: { productIds?: unknown } | null }>(
    `${path}/preview`,
    { preHandler: owner },
    (request) => {
      const ids = parseJewelrySetProductIds(request.body?.productIds);
      if (!ids) throw new AccessError("INVALID_JEWELRY_SET", "productIds");
      return previewJewelrySet(db!, request.access!, ids);
    },
  );
  app.post<Scope>(path, { preHandler: owner }, async (request, reply) =>
    reply
      .code(201)
      .send(
        await saveJewelrySet(db!, request.access!, readInput(request.body)),
      ),
  );
  app.patch<SetById & { Querystring: { revision?: string } }>(
    `${path}/:id`,
    { preHandler: owner },
    (request) =>
      saveJewelrySet(db!, request.access!, readInput(request.body), {
        id: request.params.id,
        revision: readRevision(request.query.revision),
      }),
  );
  app.delete<SetById & { Querystring: { revision?: string } }>(
    `${path}/:id`,
    { preHandler: owner },
    async (request, reply) => {
      await dissolveJewelrySet(
        db!,
        request.access!,
        request.params.id,
        readRevision(request.query.revision),
      );
      return reply.code(204).send();
    },
  );
}
