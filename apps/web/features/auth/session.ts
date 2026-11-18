import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export function authConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : undefined;
}

export async function authClient() {
  const config = authConfig();
  if (!config) return undefined;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components read refreshed cookies from the proxy.
        }
      },
    },
  });
}

export async function apiRequest(
  path:
    | "/me/contexts"
    | "/onboarding"
    | "/invitations/accept"
    | `/products${string}`
    | `/organizations/${string}`,
  body?: unknown,
) {
  const client = await authClient();
  if (!client) return { status: 503 };
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401 };
  try {
    const response = await fetch(
      new URL(
        `/api/v1${path}`,
        process.env.MIZAN_API_URL ?? "http://127.0.0.1:3001",
      ),
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    return {
      status: response.status,
      data: response.ok ? await response.json() : undefined,
      error: response.ok
        ? undefined
        : ((await response.json().catch(() => undefined)) as
            { code?: string; field?: string } | undefined),
    };
  } catch {
    return { status: 503 };
  }
}

export const requestContexts = cache(() => apiRequest("/me/contexts"));
