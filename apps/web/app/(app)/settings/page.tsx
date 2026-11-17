import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import type { StoreContext, TradingSettings } from "@mizan/contracts";
import { AuthCard } from "../../../features/auth/auth-card";
import { apiRequest, requestContexts } from "../../../features/auth/session";
import { currentLocale } from "../../../features/language/preference";
import { OrganizationSettingsForm } from "../../../features/settings/organization-settings-form";
import { PurityRateManager } from "../../../features/settings/purity-rate-manager";
import { settingsCopy } from "../../../features/settings/settings-copy";

export default async function SettingsPage({
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
  const copy = settingsCopy[locale];
  const contexts: StoreContext[] = session.status === 200 ? session.data : [];
  const owners = new Map(
    contexts
      .filter(({ role }) => role === "OWNER")
      .map(({ organizationId, organizationName }) => [
        organizationId,
        organizationName,
      ]),
  );
  const selected =
    organizationId ??
    (owners.size === 1 ? owners.keys().next().value : undefined);
  const result =
    selected && owners.has(selected)
      ? await apiRequest(
          `/organizations/${encodeURIComponent(selected)}/settings`,
        )
      : undefined;
  const data =
    result?.status === 200 ? (result.data as TradingSettings) : undefined;
  return (
    <AuthCard title={copy.title} locale={locale} wide embedded>
      <a className="gap-2" href="/workspace">
        <ArrowLeft aria-hidden="true" size={18} />
        {copy.back}
      </a>
      {data && selected ? (
        <div className="grid gap-4" key={`${selected}:${locale}`}>
          <OrganizationSettingsForm
            organizationId={selected}
            locale={locale}
            settings={data.settings}
          />
          <PurityRateManager
            organizationId={selected}
            locale={locale}
            defaultCurrency={data.settings.defaultCurrency}
            purities={data.purities}
            rates={data.rates}
          />
        </div>
      ) : session.status !== 200 || (result && result.status !== 403) ? (
        <p role="alert">{copy.failure}</p>
      ) : !selected && owners.size > 1 ? (
        <nav aria-label={copy.choose}>
          <ul>
            {[...owners].map(([id, name]) => (
              <li key={id}>
                <a
                  href={`/settings?${new URLSearchParams({ organizationId: id })}`}
                >
                  {name}
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
