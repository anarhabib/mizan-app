import type { SupabaseClient } from "@supabase/supabase-js";

export const socialProviders = ["google", "apple"] as const;
export type SocialProvider = (typeof socialProviders)[number];

export function safeReturnPath(
  value: unknown,
  origin = window.location.origin,
) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((character) => character < " " || character === "\u007f")
  )
    return undefined;

  const url = new URL(value, origin);
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return undefined;
  }
  if (
    url.origin !== origin ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /^\/(?:login|auth\/callback)\/?$/i.test(path) ||
    (/^\/invitations(?:\/|$)/i.test(path) && value !== "/invitations/accept")
  )
    return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function oauthRedirect(origin: string, returnTo?: string) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("flow", "oauth");
  const path = safeReturnPath(returnTo, origin);
  if (path) url.searchParams.set("returnTo", path);
  return url.href;
}

export async function startOAuth(
  auth: Pick<SupabaseClient["auth"], "signInWithOAuth">,
  provider: SocialProvider,
  origin: string,
  returnTo?: string,
  popup?: Window,
) {
  const { data, error } = await auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: oauthRedirect(origin, returnTo),
      skipBrowserRedirect: Boolean(popup),
    },
  });
  if (error || !data.url) throw error ?? new Error("Missing OAuth redirect");
  popup?.location.assign(data.url);
}

export function readOAuthCallback(url: URL) {
  if (url.searchParams.get("flow") !== "oauth") return null;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const error = fragment.get("error") ?? url.searchParams.get("error");
  const code = fragment.get("error_code") ?? url.searchParams.get("error_code");
  return {
    returnTo: safeReturnPath(url.searchParams.get("returnTo"), url.origin),
    error:
      error === "access_denied" || code === "access_denied"
        ? "oauthCanceled"
        : error || code
          ? "oauthError"
          : undefined,
  } as const;
}
