import Link from "next/link";
import { actionClass } from "../components/ui/button";
import { AuthCard } from "../features/auth/auth-card";
import { messages } from "../features/language/messages";
import { currentLocale } from "../features/language/preference";

export default async function Home() {
  const locale = await currentLocale();
  return (
    <AuthCard locale={locale} title="Mizan">
      <p>{messages[locale].environment}</p>
      <Link href="/sign-in" className={actionClass + " mizan-page-action"}>
        {messages[locale].signIn}
      </Link>
    </AuthCard>
  );
}
