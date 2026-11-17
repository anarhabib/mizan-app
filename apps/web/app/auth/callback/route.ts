import { NextResponse, type NextRequest } from "next/server";
import { authClient } from "../../../features/auth/session";
import { invitationTokenPattern } from "@mizan/contracts";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const client = code ? await authClient() : undefined;
  const origin = process.env.MIZAN_WEB_ORIGIN ?? "http://127.0.0.1:3000";
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const pending = request.cookies.get("mizan-pending-invitation")?.value;
      const response = NextResponse.redirect(
        new URL(
          pending && invitationTokenPattern.test(pending)
            ? `/invitations/${pending}`
            : "/register",
          origin,
        ),
      );
      response.cookies.set("mizan-pending-invitation", "", {
        path: "/auth/callback",
        maxAge: 0,
      });
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
  }
  return NextResponse.redirect(
    new URL("/register?confirmation=failed", origin),
  );
}
