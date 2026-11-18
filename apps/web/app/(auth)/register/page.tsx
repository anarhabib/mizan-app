import { redirect } from "next/navigation";
import { AuthCard } from "../../../features/auth/auth-card";
import {
  OwnerRegistrationForm,
  OwnerSetupForm,
} from "../../../features/auth/owner-registration-form";
import { signOut } from "../../../features/auth/owner-actions";
import { apiRequest } from "../../../features/auth/session";
import { currentLocale } from "../../../features/language/preference";
import { messages } from "../../../features/language/messages";

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const [{ confirmation }, result, locale] = await Promise.all([
    searchParams,
    apiRequest("/me/contexts"),
    currentLocale(),
  ]);
  const copy = messages[locale];
  if (result.status === 200 && result.data.length > 0) redirect("/workspace");
  if (result.status === 200)
    return (
      <AuthCard title={copy.setup}>
        <OwnerSetupForm key={locale} locale={locale} />
        <form action={signOut}>
          <button className="auth-secondary">{copy.signOut}</button>
        </form>
      </AuthCard>
    );
  return (
    <AuthCard title={copy.account}>
      {confirmation === "failed" && (
        <p role="alert">{copy.confirmationFailed}</p>
      )}
      {result.status === 503 && <p role="status">{copy.authUnavailable}</p>}
      <OwnerRegistrationForm key={locale} locale={locale} />
    </AuthCard>
  );
}
