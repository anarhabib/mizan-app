import type { FastifyInstance, FastifyRequest } from "fastify";
import type { SalePreviewInput } from "@mizan/contracts";
import { authenticate } from "../../plugins/auth.js";
import type { AccessOptions } from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import { resolveAccessContext } from "../access/access.service.js";
import { SaleConfirmationRequired } from "./sale-confirmation.js";
import {
  getSale,
  getSaleOptions,
  listSales,
  previewSale,
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
    const token = request.headers["sale-confirmation"];
    try {
      const sale = await recordSale(
        db!,
        request.access!,
        key,
        request.body,
        typeof token === "string" ? token : undefined,
        request.identity?.sessionId,
      );
      return reply.code(201).send(sale);
    } catch (error) {
      if (!(error instanceof SaleConfirmationRequired)) throw error;
      return reply.code(409).send({
        code: "SALE_CONFIRMATION_REQUIRED",
        message: error.message,
        confirmation: error.confirmation,
      });
    }
  });

  app.post<Scope & { Body: SalePreviewInput }>(
    "/sales/preview",
    { preHandler },
    (request) => previewSale(db!, request.access!, request.body),
  );

  app.get<Scope>("/sales/options", { preHandler }, (request) =>
    getSaleOptions(db!, request.access!),
  );

  app.get<{
    Querystring: Scope["Querystring"] & {
      q?: string;
      date?: string;
      after?: string;
    };
  }>("/sales", { preHandler }, (request) =>
    listSales(db!, request.access!, request.query),
  );

  app.get<Scope & { Params: { id: string } }>(
    "/sales/:id",
    { preHandler },
    (request) => getSale(db!, request.access!, request.params.id),
  );
}
