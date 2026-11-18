import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../../plugins/auth.js";
import type { AccessOptions } from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import { resolveAccessContext } from "../access/access.service.js";
import {
  getSale,
  getSaleOptions,
  recordSale,
  type SalesDatabase,
} from "./sale.service.js";

type Scope = { Querystring: { organizationId?: string; storeId?: string } };

export function registerSaleRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
  db?: SalesDatabase,
) {
  const preHandler =
    access && db
      ? [
          authenticate(access.db, access.verifyToken),
          async (request: FastifyRequest<Scope>) => {
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

  app.post<Scope>("/sales", { preHandler }, async (request, reply) => {
    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new AccessError("INVALID_SALE", "idempotencyKey");
    return reply
      .code(201)
      .send(await recordSale(db!, request.access!, key, request.body));
  });

  app.get<Scope>("/sales/options", { preHandler }, (request) =>
    getSaleOptions(db!, request.access!),
  );

  app.get<Scope & { Params: { id: string } }>(
    "/sales/:id",
    { preHandler },
    (request) => getSale(db!, request.access!, request.params.id),
  );
}
