import type { FastifyInstance } from "fastify";
import { parsePurity, parseRate } from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
import type { OrganizationDatabase } from "../access/organization-owner.js";
import { authenticate } from "../../plugins/auth.js";
import type { AccessOptions } from "../../plugins/request-context.js";
import {
  appendOldGoldRate,
  changePurity,
  getTradingSettings,
  setCostVisibility,
} from "./settings.service.js";

export function registerSettingsRoutes(
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
  function database() {
    if (!db) throw new AccessError("AUTH_UNAVAILABLE");
    return db;
  }
  type Scope = { organizationId: string };
  const base = "/organizations/:organizationId";
  app.get<{ Params: Scope }>(`${base}/settings`, { preHandler }, (request) =>
    getTradingSettings(
      database(),
      request.params.organizationId,
      request.identity!.userId,
    ),
  );
  app.post<{ Params: Scope; Body: Record<string, unknown> }>(
    `${base}/settings`,
    { preHandler },
    (request) => {
      const body = request.body;
      if (
        !body ||
        typeof body.salespersonCanViewAcquisitionCost !== "boolean" ||
        Object.keys(body).length !== 1
      )
        throw new AccessError("INVALID_SETTINGS");
      return setCostVisibility(
        database(),
        request.params.organizationId,
        request.identity!.userId,
        body.salespersonCanViewAcquisitionCost,
      );
    },
  );
  app.post<{ Params: Scope; Body: { value?: unknown } }>(
    `${base}/purities`,
    { preHandler },
    (request) => {
      const value = parsePurity(request.body?.value);
      if (value === null) throw new AccessError("INVALID_SETTINGS");
      return changePurity(
        database(),
        request.params.organizationId,
        request.identity!.userId,
        value,
        "add",
      );
    },
  );
  for (const action of ["deactivate", "reactivate"] as const) {
    app.post<{ Params: Scope & { value: string } }>(
      `${base}/purities/:value/${action}`,
      { preHandler },
      (request) => {
        const raw = request.params.value;
        const value = /^[1-9]\d{0,2}$/.test(raw)
          ? parsePurity(Number(raw))
          : null;
        if (value === null) throw new AccessError("INVALID_SETTINGS");
        return changePurity(
          database(),
          request.params.organizationId,
          request.identity!.userId,
          value,
          action,
        );
      },
    );
  }
  app.post<{ Params: Scope }>(`${base}/rates`, { preHandler }, (request) => {
    const rate = parseRate(request.body);
    if (!rate) throw new AccessError("INVALID_SETTINGS");
    return appendOldGoldRate(
      database(),
      request.params.organizationId,
      request.identity!.userId,
      rate,
    );
  });
}
