import type { FastifyRequest } from "fastify";
import { AccessError } from "./access.errors.js";
import type { AccessContext } from "./access.service.js";

export function canManageAsOwner(access: AccessContext) {
  return access.role === "OWNER" && !access.salespersonDisplay;
}

export function canViewAcquisition(access: AccessContext) {
  return (
    !access.salespersonDisplay &&
    (canManageAsOwner(access) ||
      access.settings.salespersonCanViewAcquisitionCost)
  );
}

export async function requireOwnerDisplay(request: FastifyRequest) {
  if (!request.identity) throw new AccessError("UNAUTHENTICATED");
  if (request.identity.salespersonDisplay)
    throw new AccessError("ACCESS_DENIED");
}
