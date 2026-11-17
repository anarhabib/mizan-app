import type { StoreContext } from "@mizan/contracts";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "../../components/shell/app-shell";
import { requestContexts } from "../../features/auth/session";
import { currentLocale } from "../../features/language/preference";

export default async function ManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [locale, result] = await Promise.all([
    currentLocale(),
    requestContexts(),
  ]);
  if (result.status === 401) redirect("/sign-in");
  const contexts: StoreContext[] = result.status === 200 ? result.data : [];
  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Baku",
  }).format();
  return (
    <Suspense>
      <AppShell contexts={contexts} dateLabel={dateLabel} locale={locale}>
        {children}
      </AppShell>
    </Suspense>
  );
}
