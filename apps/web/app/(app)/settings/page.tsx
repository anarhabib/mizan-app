import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import type { StoreContext, TradingSettings } from "@mizan/contracts";
import styles from "../../../components/ui/form-controls.module.css";
import { actionClass } from "../../../components/ui/button";
import { PageHeading } from "../../../components/ui/page-heading";
import { Surface } from "../../../components/ui/surface";
import { apiRequest, requestContexts } from "../../../features/auth/session";
import { LanguagePicker } from "../../../features/language/language-picker";
import { messages } from "../../../features/language/messages";
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
    <section className="grid gap-4">
      <PageHeading
        title={owners.size ? copy.title : messages[locale].settingsNav}
        description={selected && owners.get(selected)}
        actions={
          <a className={actionClass + " mizan-table-action"} href="/workspace">
            <ArrowLeft aria-hidden="true" size={18} />
            {copy.back}
          </a>
        }
      />
      <Surface className="grid justify-items-start gap-3 p-4 sm:p-6">
        <h2 className="m-0 text-base font-extrabold">
          {messages[locale].language}
        </h2>
        <LanguagePicker locale={locale} />
      </Surface>
      {data && selected ? (
        <div className={styles.controls} key={`${selected}:${locale}`}>
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
        <nav
          className={styles.controls + " mizan-glass-light rounded-[19px] p-4"}
          aria-label={copy.choose}
        >
          <ul>
            {[...owners].map(([id, name]) => (
              <li key={id}>
                <a
                  className={actionClass + " mizan-table-action"}
                  href={`/settings?${new URLSearchParams({ organizationId: id })}`}
                >
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : owners.size ? (
        <p role="alert">{copy.denied}</p>
      ) : null}
    </section>
  );
}
