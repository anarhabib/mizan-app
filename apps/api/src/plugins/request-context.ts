import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AccessError } from "../modules/access/access.errors.js";
import {
  resolveAccessContext,
  type AccessDatabase,
} from "../modules/access/access.service.js";
import { authenticate, type VerifyToken } from "./auth.js";
import { registerOnboardingRoutes } from "../modules/onboarding/onboarding.routes.js";
import type { OnboardingDatabase } from "../modules/onboarding/onboarding.service.js";
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
}> = async (app, { access, onboardingDb, memberships }) => {
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
    return reply
      .code(error.statusCode)
      .send({ code: error.code, message: error.message });
  });
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  registerOnboardingRoutes(app, access, onboardingDb);
  registerMembershipRoutes(app, access, memberships);

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
