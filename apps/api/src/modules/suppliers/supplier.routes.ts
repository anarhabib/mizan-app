import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../../plugins/auth.js";
import {
  requireStoreAccess,
  type AccessOptions,
} from "../../plugins/request-context.js";
import { AccessError, type AccessFailure } from "../access/access.errors.js";
import { canManageAsOwner } from "../access/display-mode.js";
import type { OrganizationDatabase } from "../access/organization-owner.js";
import {
  getPurchase,
  listActivity,
  listPayments,
  listPurchases,
  listSupplierProducts,
  listSuppliers,
  supplierOverview,
  type Filters,
} from "./supplier.queries.js";
import {
  recordSupplierPayment,
  registerPurchase,
  saveSupplier,
} from "./supplier.service.js";

type Scope = { Params: { organizationId: string; storeId: string } };
type Id = { Params: Scope["Params"] & { id: string } };
type Page = { Querystring: Filters };

function requiredKey(request: FastifyRequest, code: AccessFailure) {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
    throw new AccessError(code, "idempotencyKey");
  return key;
}

export function registerSupplierRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
  db?: OrganizationDatabase,
) {
  const preHandler =
    access && db
      ? [
          authenticate(access.db, access.verifyToken),
          requireStoreAccess(access.db),
          async (request: FastifyRequest) => {
            if (!request.access || !canManageAsOwner(request.access))
              throw new AccessError("ACCESS_DENIED");
          },
        ]
      : async () => {
          throw new AccessError("AUTH_UNAVAILABLE");
        };

  const store = "/organizations/:organizationId/stores/:storeId";
  const suppliers = store + "/suppliers";
  const purchases = store + "/purchases";
  app.get<Scope & Page>(suppliers, { preHandler }, (request) =>
    listSuppliers(db!, request.access!, request.query),
  );
  app.post<Scope>(suppliers, { preHandler }, async (request, reply) =>
    reply
      .code(201)
      .send(await saveSupplier(db!, request.access!, request.body)),
  );
  app.get<Id>(suppliers + "/:id", { preHandler }, (request) =>
    supplierOverview(db!, request.access!, request.params.id),
  );
  app.patch<Id>(suppliers + "/:id", { preHandler }, (request) =>
    saveSupplier(db!, request.access!, request.body, request.params.id),
  );
  app.get<Id & Page>(suppliers + "/:id/products", { preHandler }, (request) =>
    listSupplierProducts(
      db!,
      request.access!,
      request.params.id,
      request.query,
    ),
  );
  app.get<Id & Page>(suppliers + "/:id/payments", { preHandler }, (request) =>
    listPayments(db!, request.access!, request.params.id, request.query),
  );
  app.get<Id & Page>(suppliers + "/:id/activity", { preHandler }, (request) =>
    listActivity(db!, request.access!, request.params.id, request.query),
  );
  app.get<Scope & Page>(purchases, { preHandler }, (request) =>
    listPurchases(db!, request.access!, request.query),
  );
  app.post<Scope>(purchases, { preHandler }, async (request, reply) =>
    reply
      .code(201)
      .send(
        await registerPurchase(
          db!,
          request.access!,
          request.body,
          requiredKey(request, "INVALID_PURCHASE"),
        ),
      ),
  );
  app.get<Id>(purchases + "/:id", { preHandler }, (request) =>
    getPurchase(db!, request.access!, request.params.id),
  );
  app.post<Id>(
    purchases + "/:id/payments",
    { preHandler },
    async (request, reply) =>
      reply
        .code(201)
        .send(
          await recordSupplierPayment(
            db!,
            request.access!,
            request.params.id,
            request.body,
            requiredKey(request, "INVALID_SUPPLIER_PAYMENT"),
          ),
        ),
  );
}
