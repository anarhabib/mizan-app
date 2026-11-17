import { redirect } from "next/navigation";
import type { MembershipDirectory, StoreContext } from "@mizan/contracts";
import { AuthCard } from "../../../../features/auth/auth-card";
import { apiRequest, requestContexts } from "../../../../features/auth/session";
import { currentLocale } from "../../../../features/language/preference";
import { MemberManagement } from "../../../../features/memberships/member-management";
import { membershipCopy } from "../../../../features/memberships/membership-copy";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ organizationId }, locale, session] = await Promise.all([
    searchParams,
    currentLocale(),
    requestContexts(),
  ]);
  if (session.status === 401) redirect("/sign-in");
  const copy = membershipCopy[locale];
  const owners = new Map<string, string>();
  if (session.status === 200) {
    for (const context of session.data as StoreContext[]) {
      if (context.role === "OWNER")
        owners.set(context.organizationId, context.organizationName);
    }
  }
  const selected =
    organizationId ??
    (owners.size === 1 ? owners.keys().next().value : undefined);
  const directory =
    selected && owners.has(selected)
      ? await apiRequest(
          `/organizations/${encodeURIComponent(selected)}/memberships`,
        )
      : undefined;
  return (
    <AuthCard title={copy.title} locale={locale} wide embedded>
      <a href="/workspace">{copy.back}</a>
      {session.status !== 200 ? (
        <p role="alert">{copy.failed}</p>
      ) : directory?.status === 200 && selected ? (
        <MemberManagement
          key={`${selected}:${locale}`}
          organizationId={selected}
          locale={locale}
          directory={directory.data as MembershipDirectory}
        />
      ) : directory && directory.status !== 403 ? (
        <p role="alert">{copy.failed}</p>
      ) : !selected && owners.size > 1 ? (
        <nav aria-label={copy.chooseOrganization}>
          <ul>
            {[...owners].map(([id, label]) => (
              <li key={id}>
                <a
                  href={`/settings/users?${new URLSearchParams({ organizationId: id })}`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <p role="alert">{copy.denied}</p>
      )}
    </AuthCard>
  );
}
