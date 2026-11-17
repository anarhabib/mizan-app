import { changeLanguage } from "./language-action";
import { messages, type Locale } from "./messages";

export function LanguagePicker({
  locale,
  compact = false,
}: {
  locale: Locale;
  compact?: boolean;
}) {
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
        aria-label="Azərbaycanca"
        aria-pressed={locale === "az"}
      >
        {compact ? "AZ" : "Azərbaycanca"}
      </button>
      <button
        name="language"
        value="en"
        lang="en"
        aria-label="English"
        aria-pressed={locale === "en"}
      >
        {compact ? "EN" : "English"}
      </button>
    </form>
  );
}
