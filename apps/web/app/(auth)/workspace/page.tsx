import { redirect } from "next/navigation";
import type { StoreContext } from "@mizan/contracts";
import { AuthCard } from "../../../features/auth/auth-card";
import { signOut } from "../../../features/auth/owner-actions";
import { apiRequest } from "../../../features/auth/session";
import {
  chooseContext,
  ContextPicker,
} from "../../../features/context/context-picker";
import { currentLocale } from "../../../features/language/preference";
import { messages } from "../../../features/language/messages";
import { membershipCopy } from "../../../features/memberships/membership-copy";
import { settingsCopy } from "../../../features/settings/settings-copy";
import { Settings } from "lucide-react";

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; storeId?: string }>;
}) {
  const [{ organizationId, storeId }, result, locale] = await Promise.all([
    searchParams,
    apiRequest("/me/contexts"),
    currentLocale(),
  ]);
  const copy = messages[locale];
  if (result.status === 401) redirect("/register");
  if (result.status !== 200)
    return (
      <AuthCard title={copy.store} locale={locale}>
        <p role="alert">{copy.storeUnavailable}</p>
        <a href="/workspace">{copy.retry}</a>
      </AuthCard>
    );
  const contexts = result.data as StoreContext[];
  if (!contexts.length) redirect("/register");
  const selected = chooseContext(contexts, organizationId, storeId);
  return (
    <AuthCard title={selected?.storeName ?? copy.store} locale={locale}>
      {selected && (
        <p>
          {selected.organizationName} ·{" "}
          {selected.role === "OWNER" ? copy.owner : copy.salesperson}
        </p>
      )}
      {!selected && (organizationId || storeId) && (
        <p role="alert">{copy.accessDenied}</p>
      )}
      {!selected && contexts.length === 1 && (
        <a href="/workspace">{copy.openStore}</a>
      )}
      <ContextPicker contexts={contexts} selected={selected} locale={locale} />
      {selected?.role === "OWNER" && (
        <p>
          <a
            className="gap-2"
            href={`/settings?${new URLSearchParams({ organizationId: selected.organizationId })}`}
          >
            <Settings aria-hidden="true" size={18} />
            {settingsCopy[locale].title}
          </a>
        </p>
      )}
      {selected?.role === "OWNER" && (
        <p>
          <a
            href={`/settings/users?${new URLSearchParams({ organizationId: selected.organizationId })}`}
          >
            {membershipCopy[locale].title}
          </a>
        </p>
      )}
      <form action={signOut}>
        <button className="auth-secondary">{copy.signOut}</button>
      </form>
    </AuthCard>
  );
}
