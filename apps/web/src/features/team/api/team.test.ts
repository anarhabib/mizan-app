import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyTeamAction,
  teamDirectoryQuery,
  teamKeys,
  type TeamAction,
} from "./team";

const scope = { organizationId: "org", storeId: "active-store" };

afterEach(() => vi.unstubAllGlobals());

describe("team API", () => {
  it.each<[TeamAction, string, string | undefined]>([
    [
      { kind: "invite", email: "staff@example.test", storeId: "other-store" },
      "invitations",
      "sent",
    ],
    [
      { kind: "resend", invitationId: "invite/1" },
      "invitations/invite%2F1/resend",
      "failed",
    ],
    [
      { kind: "revoke", invitationId: "invite/1" },
      "invitations/invite%2F1/revoke",
      "not_sent",
    ],
    [
      { kind: "deactivate", userId: "user/1" },
      "members/user%2F1/deactivate",
      undefined,
    ],
    [
      { kind: "reactivate", userId: "user/1" },
      "members/user%2F1/reactivate",
      undefined,
    ],
    [
      { kind: "assign", userId: "user/1", storeId: "store/1" },
      "members/user%2F1/stores/store%2F1/assign",
      undefined,
    ],
    [
      { kind: "remove", userId: "user/1", storeId: "store/1" },
      "members/user%2F1/stores/store%2F1/remove",
      undefined,
    ],
  ])(
    "posts $kind and only returns documented delivery",
    async (action, suffix, delivery) => {
      const fetch = vi.fn().mockResolvedValue(
        Response.json({
          delivery: delivery ?? "sent",
          undocumented: "ignored",
        }),
      );
      vi.stubGlobal("fetch", fetch);

      expect(await applyTeamAction(scope, action)).toBe(delivery);
      const [[url, request]] = fetch.mock.calls;
      expect(url).toMatch(new RegExp(`/organizations/org/${suffix}$`));
      expect(request.method).toBe("POST");
      if (action.kind === "invite") {
        expect(JSON.parse(request.body)).toEqual({
          email: action.email,
          storeId: action.storeId,
        });
      } else {
        expect(request.body).toBeUndefined();
      }
    },
  );

  it("scopes the directory cache to the organization and selected store", () => {
    expect(teamDirectoryQuery(scope).queryKey).toEqual(
      teamKeys.directory(scope),
    );
    expect(teamKeys.directory(scope)).toEqual([
      "team",
      "org",
      "active-store",
      "directory",
    ]);
  });
});
