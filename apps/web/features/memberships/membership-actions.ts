"use server";

import { invitationTokenPattern } from "@mizan/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "../auth/session";
import { currentLocale } from "../language/preference";
import { membershipCopy } from "./membership-copy";

type State = { error?: string; notice?: string };

export async function updateMembers(
  organizationId: string,
  _state: State,
  form: FormData,
): Promise<State> {
  const copy = membershipCopy[await currentLocale()];
  const base = `/organizations/${encodeURIComponent(organizationId)}` as const;
  const intent = form.get("intent");
  const id = encodeURIComponent(String(form.get("id") ?? ""));
  const storeId = String(form.get("storeId") ?? "");
  let path: `/organizations/${string}`;
  let body: object = {};
  if (intent === "invite") {
    path = `${base}/invitations`;
    body = { storeId, email: form.get("email") };
  } else if (intent === "revoke" || intent === "resend") {
    path = `${base}/invitations/${id}/${intent}`;
  } else if (intent === "deactivate" || intent === "reactivate") {
    path = `${base}/members/${id}/${intent}`;
  } else if (intent === "assign" || intent === "remove") {
    path = `${base}/members/${id}/stores/${encodeURIComponent(storeId)}/${intent}`;
  } else return { error: copy.invalid };
  const result = await apiRequest(path, body);
  if (result.status === 401 || result.status === 403)
    return { error: copy.denied };
  if (result.status === 400) return { error: copy.invalid };
  if (result.status === 409) return { error: copy.unavailable };
  if (result.status !== 200) return { error: copy.failed };
  revalidatePath("/settings/users");
  if (result.data?.delivery === "sent") return { notice: copy.sent };
  if (result.data?.delivery === "failed") return { error: copy.deliveryFailed };
  if (intent === "invite" && result.data?.delivery === "not_sent")
    return { notice: copy.alreadyPending };
  return { notice: copy.saved };
}

export async function acceptMembership(token: string): Promise<State> {
  const copy = membershipCopy[await currentLocale()];
  if (!invitationTokenPattern.test(token)) return { error: copy.unavailable };
  const result = await apiRequest("/invitations/accept", { token });
  if (result.status === 409) return { error: copy.unavailable };
  if (result.status !== 200) return { error: copy.failed };
  const { organizationId, storeId } = result.data;
  redirect(`/workspace?${new URLSearchParams({ organizationId, storeId })}`);
}
