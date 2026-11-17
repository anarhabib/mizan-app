import { redirect } from "next/navigation";
import type { StoreContext } from "@mizan/contracts";
import { AuthCard } from "../../../features/auth/auth-card";
import { requestContexts } from "../../../features/auth/session";
import {
  chooseContext,
  ContextPicker,
} from "../../../features/context/context-picker";
import { currentLocale } from "../../../features/language/preference";
import { messages } from "../../../features/language/messages";

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; storeId?: string }>;
}) {
  const [{ organizationId, storeId }, result, locale] = await Promise.all([
    searchParams,
    requestContexts(),
    currentLocale(),
  ]);
  const copy = messages[locale];
  if (result.status === 401) redirect("/sign-in");
  if (result.status !== 200)
    return (
      <AuthCard title={copy.store} locale={locale} embedded>
        <p role="alert">{copy.storeUnavailable}</p>
        <a href="/workspace">{copy.retry}</a>
      </AuthCard>
    );
  const contexts = result.data as StoreContext[];
  if (!contexts.length) redirect("/register");
  const selected = chooseContext(contexts, organizationId, storeId);
  return (
    <AuthCard
      title={selected?.storeName ?? copy.store}
      locale={locale}
      embedded
    >
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
    </AuthCard>
  );
}
