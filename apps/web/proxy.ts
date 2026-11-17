import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "./features/auth/session";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const finish = () => {
    response.headers.set("Cache-Control", "private, no-store");
    if (request.nextUrl.pathname.startsWith("/invitations/"))
      response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const config = authConfig();
  if (!config) return finish();
  const client = createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items, headers) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        for (const [name, value] of Object.entries(headers ?? {}))
          response.headers.set(name, value);
      },
    },
  });
  // Refresh the cookie when necessary. Fastify validates the token and the selected scope.
  await client.auth.getSession();
  return finish();
}

export const config = {
  matcher: [
    "/register",
    "/workspace",
    "/settings/:path*",
    "/invitations/:token",
  ],
};
