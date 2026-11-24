import { expect, test, vi } from "vitest";
import {
  oauthRedirect,
  readOAuthCallback,
  safeReturnPath,
  socialProviders,
  startOAuth,
} from "./oauth";

const origin = "https://misqal.test";

test.each(socialProviders)(
  "starts %s in Supabase through the existing callback",
  async (provider) => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider, url: "https://auth.test/authorize" },
      error: null,
    });
    await startOAuth(
      { signInWithOAuth },
      provider,
      origin,
      "/products?status=IN_STOCK",
    );
    expect(signInWithOAuth).toHaveBeenCalledExactlyOnceWith({
      provider,
      options: {
        redirectTo:
          "https://misqal.test/auth/callback?flow=oauth&returnTo=%2Fproducts%3Fstatus%3DIN_STOCK",
        skipBrowserRedirect: false,
      },
    });
  },
);

test("keeps an invitation token out of OAuth and uses the supplied tab", async () => {
  const url = "https://auth.test/authorize";
  const signInWithOAuth = vi
    .fn()
    .mockResolvedValue({ data: { url }, error: null });
  const assign = vi.fn();
  await startOAuth(
    { signInWithOAuth },
    "apple",
    origin,
    "/invitations/accept",
    { location: { assign } } as unknown as Window,
  );
  expect(signInWithOAuth).toHaveBeenCalledWith(
    expect.objectContaining({
      options: {
        redirectTo: oauthRedirect(origin, "/invitations/accept"),
        skipBrowserRedirect: true,
      },
    }),
  );
  expect(assign).toHaveBeenCalledWith(url);
  expect(oauthRedirect(origin, "/invitations/secret")).not.toContain("secret");
});

test("validates callback redirects and routes errors without exposing provider messages", async () => {
  for (const value of [
    "//another.test",
    "/%2fanother.test",
    "/\\another.test",
    "/login",
    "/auth/callback",
    "/invitations/secret",
  ])
    expect(safeReturnPath(value, origin)).toBeUndefined();
  expect(
    readOAuthCallback(new URL("/auth/callback?code=recovery-code", origin)),
  ).toBeNull();
  expect(
    readOAuthCallback(
      new URL(
        "/auth/callback?flow=oauth&returnTo=%2Fproducts#error=access_denied&error_description=provider-details",
        origin,
      ),
    ),
  ).toEqual({ returnTo: "/products", error: "oauthCanceled" });
  expect(
    readOAuthCallback(
      new URL(
        "/auth/callback?flow=oauth&returnTo=%2F%2Fevil.test&error_code=server_error",
        origin,
      ),
    ),
  ).toEqual({ returnTo: undefined, error: "oauthError" });
  const error = new Error("Provider unavailable");
  const signInWithOAuth = vi
    .fn()
    .mockResolvedValue({ data: { url: null }, error });
  await expect(startOAuth({ signInWithOAuth }, "google", origin)).rejects.toBe(
    error,
  );
});
