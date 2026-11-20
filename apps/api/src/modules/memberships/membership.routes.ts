import type { FastifyInstance } from "fastify";
import {
  invitationTokenPattern,
  normalizeInvitationEmail,
  type InvitationDelivery,
  type InvitationSummary,
} from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
import { requireOwnerDisplay } from "../access/display-mode.js";
import { authenticate, readBearerToken } from "../../plugins/auth.js";
import type { AccessOptions } from "../../plugins/request-context.js";
import {
  acceptInvitation,
  changeInvitation,
  changeMember,
  createInvitation,
  listMemberships,
  type MembershipDatabase,
} from "./membership.service.js";

export interface MembershipOptions {
  db: MembershipDatabase;
  verifiedEmail: (bearer: string, userId: string) => Promise<string | null>;
  sendInvitation: (email: string, token: string) => Promise<void>;
}

export function registerMembershipRoutes(
  app: FastifyInstance,
  access?: AccessOptions,
  options?: MembershipOptions,
) {
  const authenticateMember =
    access && options
      ? authenticate(access.db, access.verifyToken)
      : async () => {
          throw new AccessError("AUTH_UNAVAILABLE");
        };
  const preHandler = [authenticateMember, requireOwnerDisplay];
  function configured() {
    if (!options) throw new AccessError("AUTH_UNAVAILABLE");
    return options;
  }
  async function deliver({
    summary,
    token,
  }: {
    summary: InvitationSummary;
    token?: string;
  }) {
    let delivery: InvitationDelivery = "not_sent";
    if (token) {
      try {
        await configured().sendInvitation(summary.email, token);
        delivery = "sent";
      } catch {
        // Creation has committed. The owner can retry with a new link.
        delivery = "failed";
      }
    }
    return { ...summary, delivery };
  }
  const base = "/organizations/:organizationId";
  type Organization = { organizationId: string };
  type Member = Organization & { userId: string };
  app.get<{ Params: Organization }>(
    `${base}/memberships`,
    { preHandler },
    (request) =>
      listMemberships(
        configured().db,
        request.params.organizationId,
        request.identity!.userId,
      ),
  );
  app.post<{
    Params: Organization;
    Body: { email?: unknown; storeId?: unknown };
  }>(`${base}/invitations`, { preHandler }, async (request) => {
    const email = normalizeInvitationEmail(request.body?.email);
    const storeId = request.body?.storeId;
    if (!email || typeof storeId !== "string")
      throw new AccessError("INVALID_MEMBERSHIP");
    return deliver(
      await createInvitation(
        configured().db,
        request.params.organizationId,
        request.identity!.userId,
        storeId,
        email,
      ),
    );
  });
  for (const action of ["revoke", "resend"] as const) {
    app.post<{ Params: Organization & { id: string } }>(
      `${base}/invitations/:id/${action}`,
      { preHandler },
      async (request) => {
        const { organizationId, id } = request.params;
        return deliver(
          await changeInvitation(
            configured().db,
            organizationId,
            request.identity!.userId,
            id,
            action,
          ),
        );
      },
    );
  }
  for (const [action, active] of [
    ["deactivate", false],
    ["reactivate", true],
  ] as const) {
    app.post<{ Params: Member }>(
      `${base}/members/:userId/${action}`,
      { preHandler },
      (request) => {
        const { organizationId, userId } = request.params;
        return changeMember(
          configured().db,
          organizationId,
          request.identity!.userId,
          userId,
          { active },
        );
      },
    );
  }
  for (const [action, assign] of [
    ["assign", true],
    ["remove", false],
  ] as const) {
    app.post<{ Params: Member & { storeId: string } }>(
      `${base}/members/:userId/stores/:storeId/${action}`,
      { preHandler },
      (request) => {
        const { organizationId, userId, storeId } = request.params;
        return changeMember(
          configured().db,
          organizationId,
          request.identity!.userId,
          userId,
          { storeId, assign },
        );
      },
    );
  }
  app.post<{ Body: { token?: unknown } }>(
    "/invitations/accept",
    { preHandler: authenticateMember },
    async (request) => {
      const token = request.body?.token;
      if (typeof token !== "string" || !invitationTokenPattern.test(token))
        throw new AccessError("INVITATION_UNAVAILABLE");
      const bearer = readBearerToken(request);
      if (!bearer || !request.identity)
        throw new AccessError("UNAUTHENTICATED");
      const { userId } = request.identity;
      const { db, verifiedEmail } = configured();
      const email = normalizeInvitationEmail(
        await verifiedEmail(bearer, userId),
      );
      if (!email) throw new AccessError("INVITATION_UNAVAILABLE");
      return acceptInvitation(db, userId, token, email);
    },
  );
}
