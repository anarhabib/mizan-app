import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "../../../components/brand/brand-mark";
import { actionClass } from "../../../components/ui/button";
import { Feedback } from "../../../components/ui/feedback";
import { Surface } from "../../../components/ui/surface";
import { SignInForm } from "../../../features/auth/sign-in-form";
import { apiRequest } from "../../../features/auth/session";
import { LanguagePicker } from "../../../features/language/language-picker";
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
    <main className="mx-auto grid min-h-dvh w-full max-w-[455px] box-border content-center px-3 py-5 min-[480px]:px-0">
      <Surface className="overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 bg-mizan-deep px-4 py-2.5 text-mizan-dark-text sm:px-6">
          <span className="flex items-center gap-2 text-xl font-extrabold">
            <BrandMark />
            Mizan
          </span>
          <LanguagePicker locale={locale} />
        </header>
        <div className="grid gap-3.5 p-4 sm:p-6">
          <h1 className="m-0 text-2xl font-bold tracking-tight">
            {copy.signIn}
          </h1>
          {result.status === 503 && <Feedback>{copy.authUnavailable}</Feedback>}
          <SignInForm key={locale} locale={locale} />
          <Link
            href="/register"
            className={`${actionClass} border-mizan-edge bg-mizan-surface text-mizan-ink hover:bg-mizan-selected`}
          >
            {copy.signUp}
          </Link>
        </div>
      </Surface>
    </main>
  );
}
