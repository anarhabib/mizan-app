import type { ApiError } from "@/shared/lib/api";

export function teamErrorKey(error: ApiError) {
  if (error.status >= 500) return "errors.generic";
  if (error.isNetwork) return "errors.network";
  if (error.code === "ACCESS_DENIED" || error.status === 403)
    return "errors.accessDenied";
  if (error.code === "INVITATION_UNAVAILABLE")
    return "errors.invitationUnavailable";
  if (error.code === "INVALID_MEMBERSHIP") return "errors.invalidMembership";
  return "errors.generic";
}
