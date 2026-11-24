import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AccessError } from "../modules/access/access.errors.js";
import {
  resolveAccessContext,
  type AccessDatabase,
} from "../modules/access/access.service.js";
import { authenticate, type VerifyToken } from "./auth.js";
import { registerOnboardingRoutes } from "../modules/onboarding/onboarding.routes.js";
import { registerProfileRoutes } from "../modules/access/profile.routes.js";
import type { OnboardingDatabase } from "../modules/onboarding/onboarding.service.js";
import type { OrganizationDatabase } from "../modules/access/organization-owner.js";
import { registerSettingsRoutes } from "../modules/settings/settings.routes.js";
import { registerGoldPriceRoutes } from "../modules/gold-prices/gold-prices.routes.js";
import { registerProductRoutes } from "../modules/products/product.routes.js";
import { registerJewelrySetRoutes } from "../modules/products/jewelry-set.routes.js";
import { registerCategoryRoutes } from "../modules/products/category.routes.js";
import type { ProductOptions } from "../modules/products/product.service.js";
import { registerSaleRoutes } from "../modules/sales/sale.routes.js";
import { registerCustomerRoutes } from "../modules/customers/customer.routes.js";
import { registerSupplierRoutes } from "../modules/suppliers/supplier.routes.js";
import { registerDashboardRoutes } from "../modules/dashboard/dashboard.routes.js";
import type { SalesDatabase } from "../modules/sales/sale.service.js";
import {
  createExchangeRateService,
  presentExchangeRates,
  type ExchangeRateCache,
} from "../modules/exchange-rates/exchange-rates.service.js";
import {
  registerMembershipRoutes,
  type MembershipOptions,
} from "../modules/memberships/membership.routes.js";

export interface AccessOptions {
  db: AccessDatabase;
  verifyToken: VerifyToken;
}

type ScopeParams = { organizationId: string; storeId: string };

export function requireStoreAccess(db: AccessDatabase) {
  return async (request: FastifyRequest<{ Params: ScopeParams }>) => {
    if (!request.identity) throw new AccessError("UNAUTHENTICATED");
    request.access = await resolveAccessContext(
      db,
      request.identity,
      request.params.organizationId,
      request.params.storeId,
    );
  };
}

export const requestContextRoutes: FastifyPluginAsync<{
  access?: AccessOptions;
  onboardingDb?: OnboardingDatabase;
  memberships?: MembershipOptions;
  settingsDb?: OrganizationDatabase;
  products?: ProductOptions;
  salesDb?: SalesDatabase;
  exchangeRatesDb?: ExchangeRateCache;
  goldMarketEnabled?: boolean;
  goldPriceSync?: "interval" | "on-demand";
}> = async (
  app,
  {
    access,
    onboardingDb,
    memberships,
    settingsDb,
    products,
    salesDb,
    exchangeRatesDb,
    goldMarketEnabled = true,
    goldPriceSync = "on-demand",
  },
) => {
  app.decorateRequest("identity", null);
  app.decorateRequest("access", null);

  app.setErrorHandler((error, request, reply) => {
    if (!(error instanceof AccessError)) {
      request.log.error(
        { errorType: error instanceof Error ? error.name : typeof error },
        "Access check failed",
      );
      return reply.code(500).send({
        code: "INTERNAL_ERROR",
        message: "Sorğunu emal etmək mümkün olmadı.",
      });
    }
    if (error.statusCode === 401) reply.header("WWW-Authenticate", "Bearer");
    return reply.code(error.statusCode).send({
      code: error.code,
      message: error.message,
      ...(error.field && { field: error.field }),
    });
  });
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  registerOnboardingRoutes(app, access, onboardingDb);
  registerProfileRoutes(app, access);
  registerMembershipRoutes(app, access, memberships);
  registerSettingsRoutes(app, access, settingsDb);
  registerProductRoutes(app, access, products);
  registerJewelrySetRoutes(app, access, products?.db);
  registerCategoryRoutes(app, access, settingsDb ?? products?.db);
  registerSaleRoutes(app, access, salesDb, products?.storage);
  registerCustomerRoutes(app, access, salesDb);
  registerSupplierRoutes(app, access, products?.db ?? settingsDb);
  registerDashboardRoutes(app, access, salesDb, goldMarketEnabled);

  const preHandler = access
    ? [
        authenticate(access.db, access.verifyToken),
        requireStoreAccess(access.db),
      ]
    : async () => {
        throw new AccessError("AUTH_UNAVAILABLE");
      };
  const store = "/organizations/:organizationId/stores/:storeId";
  const getExchangeRates =
    exchangeRatesDb &&
    createExchangeRateService(
      exchangeRatesDb,
      (error) =>
        app.log.warn({ err: error }, "CBAR exchange rate refresh failed"),
      undefined,
      undefined,
      settingsDb,
    );
  const refreshGold = registerGoldPriceRoutes(
    app,
    access,
    settingsDb,
    getExchangeRates,
    goldMarketEnabled,
    goldPriceSync,
  );
  if (goldPriceSync === "interval" && (refreshGold || getExchangeRates)) {
    let timer: ReturnType<typeof setInterval> | undefined;
    let sync: Promise<unknown> | undefined;
    const tick = () => {
      sync ??= Promise.allSettled([refreshGold?.(), getExchangeRates?.()])
        .then((results) => {
          for (const result of results) {
            if (result.status === "rejected")
              app.log.warn("A scheduled market data refresh failed");
          }
        })
        .finally(() => {
          sync = undefined;
        });
    };
    app.addHook("onReady", async () => {
      tick();
      timer = setInterval(tick, 60_000);
      timer.unref();
    });
    app.addHook("preClose", async () => {
      clearInterval(timer);
      await sync;
    });
  }
  app.get<{ Params: ScopeParams }>(
    `${store}/exchange-rates`,
    { preHandler },
    async () => {
      if (!getExchangeRates || !exchangeRatesDb)
        throw new AccessError("AUTH_UNAVAILABLE");
      if (goldPriceSync === "on-demand") return getExchangeRates();
      return presentExchangeRates(
        await exchangeRatesDb.findUnique({ where: { source: "CBAR" } }),
        new Date(),
      );
    },
  );
  app.get<{ Params: ScopeParams }>(
    `${store}/access`,
    { preHandler },
    async (request) => request.access,
  );
  app.post<{ Params: ScopeParams }>(
    `${store}/salesperson-mode`,
    { preHandler },
    async (request, reply) => {
      if (!access) throw new AccessError("AUTH_UNAVAILABLE");
      const { sessionId, userId } = request.identity!;
      if (!sessionId || request.access?.role !== "OWNER")
        throw new AccessError("ACCESS_DENIED");
      await access.db.salespersonDisplaySession.createMany({
        data: [{ sessionId, userId }],
        skipDuplicates: true,
      });
      return reply.code(204).send();
    },
  );
};
