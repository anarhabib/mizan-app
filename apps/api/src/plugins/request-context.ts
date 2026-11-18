import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AccessError } from "../modules/access/access.errors.js";
import {
  resolveAccessContext,
  type AccessDatabase,
} from "../modules/access/access.service.js";
import { authenticate, type VerifyToken } from "./auth.js";
import { registerOnboardingRoutes } from "../modules/onboarding/onboarding.routes.js";
import type { OnboardingDatabase } from "../modules/onboarding/onboarding.service.js";
import type { OrganizationDatabase } from "../modules/access/organization-owner.js";
import { registerSettingsRoutes } from "../modules/settings/settings.routes.js";
import { registerProductRoutes } from "../modules/products/product.routes.js";
import type { ProductOptions } from "../modules/products/product.service.js";
import { registerSaleRoutes } from "../modules/sales/sale.routes.js";
import type { SalesDatabase } from "../modules/sales/sale.service.js";
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
}> = async (
  app,
  { access, onboardingDb, memberships, settingsDb, products, salesDb },
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
  registerMembershipRoutes(app, access, memberships);
  registerSettingsRoutes(app, access, settingsDb);
  registerProductRoutes(app, access, products);
  registerSaleRoutes(app, access, salesDb);

  app.get<{ Params: ScopeParams }>(
    "/organizations/:organizationId/stores/:storeId/access",
    {
      preHandler: access
        ? [
            authenticate(access.db, access.verifyToken),
            requireStoreAccess(access.db),
          ]
        : async () => {
            throw new AccessError("AUTH_UNAVAILABLE");
          },
    },
    async (request) => request.access,
  );
};
