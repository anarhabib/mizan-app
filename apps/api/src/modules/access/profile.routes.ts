import { parseFullName, type UserProfile } from "@mizan/contracts";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../plugins/auth.js";
import type { AccessOptions } from "../../plugins/request-context.js";
import { AccessError } from "./access.errors.js";

const selection = {
  fullName: true,
  memberships: { select: { userId: true }, take: 1 },
} as const;

export function registerProfileRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
) {
  const preHandler = access
    ? authenticate(access.db, access.verifyToken)
    : async () => {
        throw new AccessError("AUTH_UNAVAILABLE");
      };

  app.get(
    "/me/profile",
    { preHandler },
    async (request): Promise<UserProfile> => {
      const row = await access!.db.user.findUniqueOrThrow({
        where: { id: request.identity!.userId },
        select: selection,
      });
      return {
        fullName: row.fullName,
        hasMembership: row.memberships.length > 0,
      };
    },
  );

  app.patch<{ Body: { fullName?: unknown } | null }>(
    "/me/profile",
    { preHandler },
    async (request): Promise<UserProfile> => {
      const fullName = parseFullName(request.body?.fullName);
      if (!fullName || Object.keys(request.body ?? {}).length !== 1)
        throw new AccessError("INVALID_PROFILE", "fullName");
      const row = await access!.db.user.update({
        where: { id: request.identity!.userId },
        data: { fullName },
        select: selection,
      });
      return {
        fullName: row.fullName,
        hasMembership: row.memberships.length > 0,
      };
    },
  );
}
