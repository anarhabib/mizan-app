import { LanguagePicker } from "../features/language/language-picker";
import { messages } from "../features/language/messages";
import { currentLocale } from "../features/language/preference";

export default async function Home() {
  const locale = await currentLocale();
  return (
    <main>
      <h1>Mizan</h1>
      <p>{messages[locale].environment}</p>
      <LanguagePicker locale={locale} />
      <a href="/register">{messages[locale].registerLink}</a>
    </main>
  );
}
