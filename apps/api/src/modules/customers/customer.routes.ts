import type { FastifyInstance } from "fastify";
import { authenticate } from "../../plugins/auth.js";
import {
  requireStoreAccess,
  type AccessOptions,
} from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import type { SalesDatabase } from "../sales/sale.service.js";
import {
  deleteCustomer,
  getCustomer,
  listCustomerPurchases,
  listCustomers,
  saveCustomer,
} from "./customer.service.js";

type Scope = { Params: { organizationId: string; storeId: string } };
type Contact = { Params: Scope["Params"] & { id: string } };
type Page = { Querystring: { q?: string; after?: string } };

export function registerCustomerRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
  db?: SalesDatabase,
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
  const path = "/organizations/:organizationId/stores/:storeId/customers";

  app.get<Scope & Page>(path, { preHandler }, (request) =>
    listCustomers(db!, request.access!, request.query),
  );
  app.post<Scope>(path, { preHandler }, async (request, reply) =>
    reply
      .code(201)
      .send(await saveCustomer(db!, request.access!, request.body)),
  );
  app.get<Contact>(`${path}/:id`, { preHandler }, (request) =>
    getCustomer(db!, request.access!, request.params.id),
  );
  app.get<Contact & Page>(`${path}/:id/purchases`, { preHandler }, (request) =>
    listCustomerPurchases(
      db!,
      request.access!,
      request.params.id,
      request.query.after,
    ),
  );
  app.patch<Contact>(`${path}/:id`, { preHandler }, (request) =>
    saveCustomer(db!, request.access!, request.body, request.params.id),
  );
  app.delete<Contact>(`${path}/:id`, { preHandler }, async (request, reply) => {
    await deleteCustomer(db!, request.access!, request.params.id);
    return reply.code(204).send();
  });
}
