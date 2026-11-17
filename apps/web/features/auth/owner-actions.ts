"use server";

import {
  parseOnboarding,
  invitationTokenPattern,
  type OnboardingRequest,
  type OnboardingResult,
} from "@mizan/contracts";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { apiRequest, authClient } from "./session";
import { currentLocale } from "../language/preference";
import { messages } from "../language/messages";

type CredentialsState = { error?: string; notice?: string; email?: string };
type OwnerSetupState = { error?: string; values?: OnboardingRequest };

export async function submitCredentials(
  _state: CredentialsState,
  form: FormData,
): Promise<CredentialsState> {
  return handleCredentials(form);
}

export async function submitSignIn(
  _state: CredentialsState,
  form: FormData,
): Promise<CredentialsState> {
  form.set("intent", "signin");
  return handleCredentials(form);
}

export async function submitInvitationCredentials(
  token: string,
  _state: CredentialsState,
  form: FormData,
): Promise<CredentialsState> {
  if (!invitationTokenPattern.test(token))
    return { error: messages[await currentLocale()].authUnavailable };
  return handleCredentials(form, token);
}

async function handleCredentials(
  form: FormData,
  invitation?: string,
): Promise<CredentialsState> {
  const copy = messages[await currentLocale()];
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const signIn = form.get("intent") === "signin";
  if (!email || email.length > 254 || !password || password.length > 256) {
    return { error: copy.invalidCredentials, email };
  }
  const client = await authClient();
  if (!client) return { error: copy.authUnavailable, email };
  if (signIn) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { error: copy.signInFailed, email };
    redirect(invitation ? `/invitations/${invitation}` : "/workspace");
  }
  const origin = process.env.MIZAN_WEB_ORIGIN ?? "http://127.0.0.1:3000";
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: new URL("/auth/callback", origin).href },
  });
  if (error) return { error: copy.signUpFailed, email };
  if (data.session)
    redirect(invitation ? `/invitations/${invitation}` : "/register");
  if (invitation) {
    (await cookies()).set("mizan-pending-invitation", invitation, {
      path: "/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https:"),
      maxAge: 3600,
    });
  }
  return { notice: copy.confirmEmail, email };
}

export async function submitOwnerSetup(
  _state: OwnerSetupState,
  form: FormData,
): Promise<OwnerSetupState> {
  const copy = messages[await currentLocale()];
  const values = {
    organizationName: String(form.get("organizationName") ?? "").slice(0, 101),
    storeName: String(form.get("storeName") ?? "").slice(0, 101),
    defaultCurrency: String(form.get("defaultCurrency") ?? "").slice(0, 4),
  };
  const body = parseOnboarding(values);
  if (!body) return { values, error: copy.invalidSetup };
  const response = await apiRequest("/onboarding", body);
  if (response.status === 401) return { values, error: copy.sessionExpired };
  if (response.status === 403) return { values, error: copy.accessDenied };
  if (response.status !== 200) return { values, error: copy.setupFailed };
  const { organizationId, storeId } = response.data as OnboardingResult;
  redirect(`/workspace?${new URLSearchParams({ organizationId, storeId })}`);
}

export async function signOut() {
  const client = await authClient();
  if (client) await client.auth.signOut({ scope: "local" });
  redirect("/sign-in");
}

export async function switchInvitationAccount(token: string) {
  const client = await authClient();
  if (client) await client.auth.signOut({ scope: "local" });
  redirect(
    invitationTokenPattern.test(token) ? `/invitations/${token}` : "/register",
  );
}
