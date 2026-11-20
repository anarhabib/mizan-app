import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/lib/api";
import { teamErrorKey } from "./errors";

describe("teamErrorKey", () => {
  it.each([
    [409, "INVITATION_UNAVAILABLE", false, "errors.invitationUnavailable"],
    [403, "ACCESS_DENIED", false, "errors.accessDenied"],
    [403, "HTTP_ERROR", false, "errors.accessDenied"],
    [400, "INVALID_MEMBERSHIP", false, "errors.invalidMembership"],
    [0, "NETWORK_ERROR", true, "errors.network"],
    [500, "ACCESS_DENIED", false, "errors.generic"],
    [503, "AUTH_UNAVAILABLE", false, "errors.generic"],
    [409, "OTHER_CONFLICT", false, "errors.generic"],
  ])("maps %s %s to localized feedback", (status, code, isNetwork, key) => {
    expect(
      teamErrorKey(
        new ApiError(status, code, "Server detail", undefined, isNetwork),
      ),
    ).toBe(key);
  });
});
