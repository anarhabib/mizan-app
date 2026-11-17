import { changeLanguage } from "./language-action";
import { messages, type Locale } from "./messages";

export function LanguagePicker({ locale }: { locale: Locale }) {
  return (
    <form
      action={changeLanguage}
      className="language-picker"
      aria-label={messages[locale].language}
    >
      <button
        name="language"
        value="az"
        lang="az"
        aria-pressed={locale === "az"}
      >
        Azərbaycanca
      </button>
      <button
        name="language"
        value="en"
        lang="en"
        aria-pressed={locale === "en"}
      >
        English
      </button>
    </form>
  );
}
