import { parseRepairCommand } from "@mizan/contracts";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../plugins/auth.js";
import {
  requireStoreAccess,
  type AccessOptions,
} from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import { canManageAsOwner } from "../access/display-mode.js";
import { requiredKey } from "../access/idempotency.js";
import type { OrganizationDatabase } from "../access/organization-owner.js";
import { getRepair, listRepairs, writeRepair } from "./repair.service.js";

type Scope = {
  Params: { organizationId: string; storeId: string; productId: string };
};

export function registerRepairRoutes(
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
  const path =
    "/organizations/:organizationId/stores/:storeId/products/:productId/repairs";

  app.get<Scope & { Querystring: { after?: string; limit?: string } }>(
    path,
    { preHandler },
    (request) =>
      listRepairs(
        db!,
        request.access!,
        request.params.productId,
        request.query,
      ),
  );
  app.get<{ Params: Scope["Params"] & { id: string } }>(
    `${path}/:id`,
    { preHandler },
    (request) =>
      getRepair(
        db!,
        request.access!,
        request.params.productId,
        request.params.id,
      ),
  );
  app.post<Scope>(path, { preHandler }, async (request, reply) => {
    if (!canManageAsOwner(request.access!))
      throw new AccessError("ACCESS_DENIED");
    const key = requiredKey(request, "INVALID_REPAIR");
    const parsed = parseRepairCommand(request.body);
    if ("field" in parsed)
      throw new AccessError("INVALID_REPAIR", parsed.field);
    const result = await writeRepair(
      db!,
      request.access!,
      request.params.productId,
      parsed.command,
      key,
    );
    return reply
      .code(parsed.command.action === "send" ? 201 : 200)
      .send(result);
  });
}
