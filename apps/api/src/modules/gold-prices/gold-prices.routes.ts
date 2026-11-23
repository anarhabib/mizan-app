import {
  goldPriceKinds,
  marketPeriods,
  type ExchangeRatesResponse,
  type GoldPricingSettings,
} from "@mizan/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../../plugins/auth.js";
import {
  requireStoreAccess,
  type AccessOptions,
} from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import { canManageAsOwner } from "../access/display-mode.js";
import type { OrganizationDatabase } from "../access/organization-owner.js";
import {
  dashboardGoldHistory,
  dashboardGoldRates,
  dashboardStoreRateHistory,
} from "../dashboard/market-history.js";
import {
  createGoldMarketService,
  getGoldPriceHistory,
  goldReferences,
  readGoldMarket,
} from "./gold-market.service.js";
import {
  activeGoldPurities,
  changeStoreGoldPrice,
  getStoreGoldRuleHistory,
  getStoreGoldRules,
  previewStoreGoldPrice,
} from "./store-pricing.service.js";

type Scope = { Params: { organizationId: string; storeId: string } };
type History = Scope & { Querystring: { after?: string; limit?: string } };
type MarketHistory = Scope & {
  Querystring: { after?: string; from?: string; through?: string };
};
type DashboardHistory = Scope & {
  Querystring: { period?: string; purity?: string; kind?: string };
};

export function registerGoldPriceRoutes(
  app: FastifyInstance,
  access: AccessOptions | undefined,
  db: OrganizationDatabase | undefined,
  getExchangeRates: (() => Promise<ExchangeRatesResponse>) | undefined,
  enabled: boolean,
  sync: "interval" | "on-demand",
) {
  const unavailable = async () => {
    throw new AccessError("AUTH_UNAVAILABLE");
  };
  const preHandler =
    access && db
      ? [
          authenticate(access.db, access.verifyToken),
          requireStoreAccess(access.db),
        ]
      : [unavailable];
  const refresh =
    db &&
    createGoldMarketService(
      db,
      getExchangeRates ?? unavailable,
      enabled,
      (error) =>
        app.log.warn(
          { errorType: error instanceof Error ? error.name : typeof error },
          "Gold price refresh failed",
        ),
    );
  const market =
    sync === "interval" ? () => readGoldMarket(db!, enabled) : refresh!;
  const path = "/organizations/:organizationId/stores/:storeId/gold-prices";
  async function references(organizationId: string) {
    const [state, purities] = await Promise.all([
      market(),
      activeGoldPurities(db!, organizationId),
    ]);
    return goldReferences(state, purities);
  }
  app.get<Scope>(path, { preHandler }, ({ params }) =>
    references(params.organizationId),
  );
  app.get<MarketHistory>(`${path}/history`, { preHandler }, ({ query }) =>
    getGoldPriceHistory(db!, query),
  );
  async function chartFilters({
    params,
    query,
  }: FastifyRequest<DashboardHistory>) {
    const period = marketPeriods.find((value) => value === query.period);
    const purities = await activeGoldPurities(db!, params.organizationId);
    const purity = purities.find((value) => String(value) === query.purity);
    if (!period || purity === undefined)
      throw new AccessError("INVALID_SETTINGS");
    return { period, purity };
  }
  app.get<DashboardHistory>(
    `${path}/chart`,
    { preHandler },
    async (request) => {
      if (request.query.purity === undefined) {
        const period = marketPeriods.find(
          (value) => value === request.query.period,
        );
        if (!period) throw new AccessError("INVALID_SETTINGS");
        return dashboardGoldHistory(db!, period, undefined);
      }
      const { period, purity } = await chartFilters(request);
      return dashboardGoldHistory(db!, period, purity);
    },
  );
  app.get<Scope>(`${path}/rates`, { preHandler }, async (request) => {
    const state = await references(request.params.organizationId);
    return dashboardGoldRates(
      db!,
      request.access!,
      state,
      state.references.map(({ purity }) => purity),
    );
  });
  app.get<DashboardHistory>(
    `${path}/rates/chart`,
    { preHandler },
    async (request) => {
      const { period, purity } = await chartFilters(request);
      const kind = goldPriceKinds.find((value) => value === request.query.kind);
      if (!kind) throw new AccessError("INVALID_SETTINGS");
      return dashboardStoreRateHistory(
        db!,
        request.access!,
        period,
        purity,
        kind,
        enabled,
      );
    },
  );
  app.get<Scope>(
    `${path}/settings`,
    { preHandler },
    async (request): Promise<GoldPricingSettings> => {
      if (!canManageAsOwner(request.access!))
        throw new AccessError("ACCESS_DENIED");
      const state = await references(request.params.organizationId);
      return {
        ...state,
        ...(await getStoreGoldRules(
          db!,
          request.access!,
          state,
          state.references.map(({ purity }) => purity),
        )),
      };
    },
  );
  app.post<Scope>(`${path}/settings`, { preHandler }, async (request) => {
    if (!canManageAsOwner(request.access!))
      throw new AccessError("ACCESS_DENIED");
    return changeStoreGoldPrice(db!, request.access!, enabled, request.body);
  });
  app.post<Scope>(
    `${path}/settings/preview`,
    { preHandler },
    async (request) => {
      if (!canManageAsOwner(request.access!))
        throw new AccessError("ACCESS_DENIED");
      return previewStoreGoldPrice(db!, request.access!, enabled, request.body);
    },
  );
  app.get<History>(
    `${path}/settings/history`,
    { preHandler },
    async (request) => {
      if (!canManageAsOwner(request.access!))
        throw new AccessError("ACCESS_DENIED");
      return getStoreGoldRuleHistory(
        db!,
        request.access!,
        request.query.after,
        request.query.limit,
      );
    },
  );
  return refresh;
}
