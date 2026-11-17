"use client";

import { useActionState } from "react";
import type { Locale } from "../language/messages";
import { acceptMembership } from "./membership-actions";
import { membershipCopy } from "./membership-copy";

export function InvitationAcceptance({
  token,
  locale,
}: {
  token: string;
  locale: Locale;
}) {
  const [state, dispatch, pending] = useActionState(
    acceptMembership.bind(null, token),
    {},
  );
  const copy = membershipCopy[locale];
  return (
    <form action={dispatch}>
      <p>{copy.wrongAccount}</p>
      <button disabled={pending}>{pending ? copy.busy : copy.accept}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
