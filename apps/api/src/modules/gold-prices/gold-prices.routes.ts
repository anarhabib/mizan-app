import type {
  ExchangeRatesResponse,
  GoldPricingSettings,
} from "@mizan/contracts";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../plugins/auth.js";
import {
  requireStoreAccess,
  type AccessOptions,
} from "../../plugins/request-context.js";
import { AccessError } from "../access/access.errors.js";
import { canManageAsOwner } from "../access/display-mode.js";
import type { OrganizationDatabase } from "../access/organization-owner.js";
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
type History = Scope & { Querystring: { after?: string } };
type MarketHistory = Scope & {
  Querystring: { after?: string; from?: string; through?: string };
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
      return getStoreGoldRuleHistory(db!, request.access!, request.query.after);
    },
  );
  return refresh;
}
