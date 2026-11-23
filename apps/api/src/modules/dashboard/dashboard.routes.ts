import type { FastifyInstance } from "fastify";
import { authenticate } from "../../plugins/auth.js";
import {
  requireStoreAccess,
  type AccessOptions,
} from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import { canManageAsOwner } from "../access/display-mode.js";
import type { SalesDatabase } from "../sales/sale.service.js";
import {
  dashboardActivity,
  dashboardAgedStock,
  dashboardCharts,
  dashboardOwnerSummary,
  dashboardSummary,
} from "./dashboard.service.js";
import { dashboardExchangeHistory } from "./market-history.js";

type Scope = { Params: { organizationId: string; storeId: string } };
type Stock = Scope & { Querystring: { days?: string } };

export function registerDashboardRoutes(
  app: FastifyInstance,
  access: AccessOptions | undefined,
  db: SalesDatabase | undefined,
  goldEnabled: boolean,
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
  const store = "/organizations/:organizationId/stores/:storeId";
  const path = `${store}/dashboard`;
  app.get<Scope>(path, { preHandler }, (request) =>
    dashboardSummary(db!, request.access!, goldEnabled),
  );
  app.get<Scope>(`${path}/owner`, { preHandler }, (request) => {
    if (!canManageAsOwner(request.access!))
      throw new AccessError("ACCESS_DENIED");
    return dashboardOwnerSummary(db!, request.access!);
  });
  app.get<Scope>(`${path}/charts`, { preHandler }, (request) =>
    dashboardCharts(db!, request.access!),
  );
  app.get<Scope>(`${path}/activity`, { preHandler }, (request) =>
    dashboardActivity(db!, request.access!),
  );
  app.get<Stock>(`${path}/aged-stock`, { preHandler }, (request) => {
    const days = request.query.days ?? "90";
    if (!/^[1-9][0-9]{0,2}$/.test(days) || Number(days) > 365)
      throw new AccessError("INVALID_SETTINGS", "days");
    return dashboardAgedStock(db!, request.access!, Number(days));
  });
  app.get<Scope>(`${store}/exchange-rates/history`, { preHandler }, () =>
    dashboardExchangeHistory(db!),
  );
}
