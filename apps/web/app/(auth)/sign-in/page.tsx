import Link from "next/link";
import { redirect } from "next/navigation";
import { actionClass } from "../../../components/ui/button";
import { Feedback } from "../../../components/ui/feedback";
import { AuthCard } from "../../../features/auth/auth-card";
import { SignInForm } from "../../../features/auth/sign-in-form";
import { apiRequest } from "../../../features/auth/session";
import { messages } from "../../../features/language/messages";
import { currentLocale } from "../../../features/language/preference";

export default async function SignInPage() {
  const [locale, result] = await Promise.all([
    currentLocale(),
    apiRequest("/me/contexts"),
  ]);
  if (result.status === 200)
    redirect(result.data.length ? "/workspace" : "/register");
  const copy = messages[locale];
  return (
    <AuthCard title={copy.signIn}>
      {result.status === 503 && <Feedback>{copy.authUnavailable}</Feedback>}
      <SignInForm key={locale} locale={locale} />
      <Link
        href="/register"
        className={`${actionClass} border-mizan-edge bg-mizan-surface text-mizan-ink hover:bg-mizan-selected`}
      >
        {copy.signUp}
      </Link>
    </AuthCard>
  );
}
