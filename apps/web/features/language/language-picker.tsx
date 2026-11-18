"use client";

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
    <form action={changeLanguage}>
      <select
        key={locale}
        name="language"
        aria-label={messages[locale].language}
        className="language-picker"
        defaultValue={locale}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="az" lang="az" aria-label="Azərbaycanca">
          {compact ? "AZ" : "Azərbaycanca"}
        </option>
        <option value="en" lang="en" aria-label="English">
          {compact ? "EN" : "English"}
        </option>
      </select>
    </form>
  );
}
