import Fastify, { type FastifyInstance } from "fastify";
import type { OnboardingDatabase } from "./modules/onboarding/onboarding.service.js";
import type { MembershipOptions } from "./modules/memberships/membership.routes.js";
import type { OrganizationDatabase } from "./modules/access/organization-owner.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import {
  requestContextRoutes,
  type AccessOptions,
} from "./plugins/request-context.js";

export interface BuildAppOptions {
  logger?: boolean;
  access?: AccessOptions;
  onboardingDb?: OnboardingDatabase;
  memberships?: MembershipOptions;
  settingsDb?: OrganizationDatabase;
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ? { redact: ["req.headers.authorization"] } : false,
  });
  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(requestContextRoutes, {
    prefix: "/api/v1",
    access: options.access,
    onboardingDb: options.onboardingDb,
    memberships: options.memberships,
    settingsDb: options.settingsDb,
  });
  return app;
}
