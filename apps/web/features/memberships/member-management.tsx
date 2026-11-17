"use client";

import { useActionState, type ReactNode } from "react";
import type { MembershipDirectory, StoreOption } from "@mizan/contracts";
import type { Locale } from "../language/messages";
import { updateMembers } from "./membership-actions";
import { membershipCopy } from "./membership-copy";

function MemberForm({
  organizationId,
  intent,
  id,
  label,
  locale,
  children,
}: {
  organizationId: string;
  intent: string;
  id?: string;
  label: string;
  locale: Locale;
  children?: ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(
    updateMembers.bind(null, organizationId),
    {},
  );
  return (
    <form action={dispatch}>
      <input type="hidden" name="intent" value={intent} />
      {id && <input type="hidden" name="id" value={id} />}
      {children}
      <button
        type="submit"
        className={intent === "invite" ? undefined : "auth-secondary"}
        disabled={pending}
      >
        {pending ? membershipCopy[locale].busy : label}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.notice && <p role="status">{state.notice}</p>}
    </form>
  );
}

function StoreField({
  stores,
  locale,
}: {
  stores: StoreOption[];
  locale: Locale;
}) {
  return (
    <label>
      {membershipCopy[locale].store}
      <select name="storeId" required>
        {stores.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MemberManagement({
  organizationId,
  locale,
  directory,
}: {
  organizationId: string;
  locale: Locale;
  directory: MembershipDirectory;
}) {
  const copy = membershipCopy[locale];
  const { stores, invitations, members } = directory;
  const storesById = new Map(stores.map((store) => [store.id, store.name]));
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Baku",
  });
  return (
    <>
      <MemberForm
        organizationId={organizationId}
        intent="invite"
        label={copy.send}
        locale={locale}
      >
        <label>
          {copy.email}
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        <StoreField stores={stores} locale={locale} />
      </MemberForm>
      <h2>{copy.invitations}</h2>
      {invitations.length === 0 ? (
        <p>{copy.emptyInvites}</p>
      ) : (
        <ul className="membership-list">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              <p>
                <strong>{invitation.email}</strong>
              </p>
              <p>
                {storesById.get(invitation.storeId)} · {copy[invitation.status]}{" "}
                ·{" "}
                <time dateTime={invitation.expiresAt}>
                  {date.format(new Date(invitation.expiresAt))}
                </time>
              </p>
              {(invitation.status === "pending" ||
                invitation.status === "expired") && (
                <div className="membership-actions">
                  <MemberForm
                    organizationId={organizationId}
                    intent="resend"
                    id={invitation.id}
                    label={copy.resend}
                    locale={locale}
                  />
                  {invitation.status === "pending" && (
                    <MemberForm
                      organizationId={organizationId}
                      intent="revoke"
                      id={invitation.id}
                      label={copy.revoke}
                      locale={locale}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <h2>{copy.members}</h2>
      {members.length === 0 ? (
        <p>{copy.emptyMembers}</p>
      ) : (
        <ul className="membership-list">
          {members.map((member) => {
            const assigned = stores.filter(({ id }) =>
              member.storeIds.includes(id),
            );
            const available = stores.filter(
              ({ id }) => !member.storeIds.includes(id),
            );
            return (
              <li key={member.userId}>
                <p>
                  <strong>{member.email ?? member.userId}</strong> ·{" "}
                  {copy[member.status]}
                </p>
                <p>
                  {assigned.length
                    ? assigned.map(({ name }) => name).join(", ")
                    : copy.noStores}
                </p>
                <div className="membership-actions">
                  <MemberForm
                    organizationId={organizationId}
                    id={member.userId}
                    locale={locale}
                    intent={
                      member.status === "active" ? "deactivate" : "reactivate"
                    }
                    label={
                      member.status === "active"
                        ? copy.deactivate
                        : copy.reactivate
                    }
                  />
                  {available.length > 0 && (
                    <MemberForm
                      organizationId={organizationId}
                      intent="assign"
                      id={member.userId}
                      label={copy.assign}
                      locale={locale}
                    >
                      <StoreField stores={available} locale={locale} />
                    </MemberForm>
                  )}
                  {assigned.length > 0 && (
                    <MemberForm
                      organizationId={organizationId}
                      intent="remove"
                      id={member.userId}
                      label={copy.remove}
                      locale={locale}
                    >
                      <StoreField stores={assigned} locale={locale} />
                    </MemberForm>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
