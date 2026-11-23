import type { FastifyInstance } from "fastify";
import { parseOnboarding } from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
import { requireOwnerDisplay } from "../access/display-mode.js";
import { authenticate } from "../../plugins/auth.js";
import type { AccessOptions } from "../../plugins/request-context.js";
import {
  listStoreContexts,
  provisionOwnerWorkspace,
  type OnboardingDatabase,
} from "./onboarding.service.js";

export function registerOnboardingRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
  db?: OnboardingDatabase,
) {
  const preHandler =
    access && db
      ? authenticate(access.db, access.verifyToken)
      : async () => {
          throw new AccessError("AUTH_UNAVAILABLE");
        };
  app.post(
    "/onboarding",
    { preHandler: [preHandler, requireOwnerDisplay] },
    async (request, reply) => {
      if (!db || !request.identity) throw new AccessError("UNAUTHENTICATED");
      const input = parseOnboarding(request.body);
      if (!input)
        return reply.code(400).send({
          code: "INVALID_ONBOARDING",
          message: "Ad, təşkilat, mağaza və valyuta məlumatlarını yoxlayın.",
        });
      return provisionOwnerWorkspace(db, request.identity.userId, input);
    },
  );
  app.get("/me/contexts", { preHandler }, async (request) => {
    if (!db || !request.identity) throw new AccessError("UNAUTHENTICATED");
    return listStoreContexts(db, request.identity.userId);
  });
}
