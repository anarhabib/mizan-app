import { invitationTokenPattern } from "@mizan/contracts";
import { AuthCard } from "../../../../features/auth/auth-card";
import { OwnerRegistrationForm } from "../../../../features/auth/owner-registration-form";
import { switchInvitationAccount } from "../../../../features/auth/owner-actions";
import { apiRequest } from "../../../../features/auth/session";
import { currentLocale } from "../../../../features/language/preference";
import { InvitationAcceptance } from "../../../../features/memberships/invitation-acceptance";
import { membershipCopy } from "../../../../features/memberships/membership-copy";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, locale] = await Promise.all([params, currentLocale()]);
  const copy = membershipCopy[locale];
  if (!invitationTokenPattern.test(token))
    return (
      <AuthCard locale={locale} title={copy.acceptTitle}>
        <p role="alert">{copy.unavailable}</p>
      </AuthCard>
    );
  const session = await apiRequest("/me/contexts");
  return (
    <AuthCard locale={locale} title={copy.acceptTitle}>
      {session.status === 401 ? (
        <>
          <p>{copy.useInvitedEmail}</p>
          <OwnerRegistrationForm
            key={locale}
            locale={locale}
            invitation={token}
          />
        </>
      ) : session.status === 200 ? (
        <>
          <InvitationAcceptance key={locale} token={token} locale={locale} />
          <form action={switchInvitationAccount.bind(null, token)}>
            <button className="auth-secondary">{copy.switchAccount}</button>
          </form>
        </>
      ) : (
        <p role="alert">{copy.failed}</p>
      )}
    </AuthCard>
  );
}
