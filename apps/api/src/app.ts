import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { OnboardingDatabase } from "./modules/onboarding/onboarding.service.js";
import type { MembershipOptions } from "./modules/memberships/membership.routes.js";
import type { OrganizationDatabase } from "./modules/access/organization-owner.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import type { ProductOptions } from "./modules/products/product.service.js";
import type { SalesDatabase } from "./modules/sales/sale.service.js";
import type { ExchangeRateCache } from "./modules/exchange-rates/exchange-rates.service.js";
import {
  requestContextRoutes,
  type AccessOptions,
} from "./plugins/request-context.js";

export interface BuildAppOptions {
  logger?: boolean;
  webOrigin?: string;
  access?: AccessOptions;
  onboardingDb?: OnboardingDatabase;
  memberships?: MembershipOptions;
  settingsDb?: OrganizationDatabase;
  products?: ProductOptions;
  salesDb?: SalesDatabase;
  exchangeRatesDb?: ExchangeRateCache;
  goldMarketEnabled?: boolean;
  goldPriceSync?: "interval" | "on-demand";
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const webOrigin = options.webOrigin;
  if (webOrigin) {
    const url = URL.parse(webOrigin);
    if (
      !url ||
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== webOrigin
    ) {
      throw new Error("MIZAN_WEB_ORIGIN must be a single HTTP(S) origin");
    }
  }
  const app = Fastify({
    logger: options.logger ? { redact: ["req.headers.authorization"] } : false,
  });
  if (webOrigin) {
    await app.register(cors, {
      origin: [webOrigin],
      methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "Sale-Confirmation",
      ],
    });
  }
  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(requestContextRoutes, {
    prefix: "/api/v1",
    access: options.access,
    onboardingDb: options.onboardingDb,
    memberships: options.memberships,
    settingsDb: options.settingsDb,
    products: options.products,
    salesDb: options.salesDb,
    exchangeRatesDb: options.exchangeRatesDb,
    goldMarketEnabled: options.goldMarketEnabled,
    goldPriceSync: options.goldPriceSync,
  });
  return app;
}
