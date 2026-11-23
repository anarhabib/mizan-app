import type { FastifyInstance, FastifyRequest } from "fastify";
import type { SalePreviewInput } from "@mizan/contracts";
import { authenticate } from "../../plugins/auth.js";
import type { AccessOptions } from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import { resolveAccessContext } from "../access/access.service.js";
import type { ProductPhotoStorage } from "../products/product.storage.js";
import { SaleConfirmationRequired } from "./sale-confirmation.js";
import { parsePayment } from "./sale-input.js";
import { formatPaymentAzn, SaleDecimal } from "./settlement.js";
import {
  getSale,
  getSaleOptions,
  listSales,
  previewSale,
  recordRepayment,
  recordSale,
  type SalesDatabase,
} from "./sale.service.js";

type Scope = { Querystring: { organizationId?: string; storeId?: string } };

function idempotencyKey(request: FastifyRequest) {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
    throw new AccessError("INVALID_SALE", "idempotencyKey");
  return key;
}

export function registerSaleRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
  db?: SalesDatabase,
  storage?: ProductPhotoStorage,
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
    const key = idempotencyKey(request);
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

  app.post<Scope>("/sales/payment-preview", { preHandler }, (request) => {
    const { amount, exchangeRate } = parsePayment(request.body);
    return {
      amount: formatPaymentAzn(new SaleDecimal(amount).times(exchangeRate)),
      currency: "AZN",
    };
  });

  app.get<{
    Querystring: Scope["Querystring"] & {
      q?: string;
      date?: string;
      paymentDate?: string;
      paymentStatus?: string;
      after?: string;
      limit?: string;
      photos?: string;
    };
  }>("/sales", { preHandler }, (request) =>
    listSales(
      db!,
      request.access!,
      { ...request.query, photos: request.query.photos === "1" },
      storage,
    ),
  );

  app.get<Scope & { Params: { id: string } }>(
    "/sales/:id",
    { preHandler },
    (request) => getSale(db!, request.access!, request.params.id),
  );

  app.post<Scope & { Params: { id: string } }>(
    "/sales/:id/payments",
    { preHandler },
    async (request, reply) => {
      const sale = await recordRepayment(
        db!,
        request.access!,
        request.params.id,
        idempotencyKey(request),
        request.body,
        request.identity?.sessionId,
      );
      return reply.code(201).send(sale);
    },
  );
}
