"use client";

import { ChevronDown } from "lucide-react";
import { changeLanguage } from "./language-action";
import { messages, type Locale } from "./messages";

export function LanguagePicker({ locale }: { locale: Locale }) {
  return (
    <form
      action={changeLanguage}
      className="relative grid size-11 place-items-center"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none flex items-center gap-0.5"
      >
        {locale === "az" ? (
          <svg viewBox="0 0 24 16" className="h-3.5 w-5 rounded-[2px]">
            <path fill="#00b5e2" d="M0 0h24v16H0z" />
            <path fill="#ef3340" d="M0 5.33h24v5.34H0z" />
            <path fill="#509e2f" d="M0 10.67h24V16H0z" />
            <circle cx="11" cy="8" r="2" fill="#fff" />
            <circle cx="11.65" cy="8" r="1.65" fill="#ef3340" />
            <path
              fill="#fff"
              d="m13.5 6.9.24.75.74-.24-.37.59.37.59-.74-.24-.24.75-.24-.75-.74.24.37-.59-.37-.59.74.24z"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 16" className="h-3.5 w-5 rounded-[2px]">
            <path fill="#012169" d="M0 0h24v16H0z" />
            <path stroke="#fff" strokeWidth="4" d="m0 0 24 16m0-16L0 16" />
            <path stroke="#c8102e" strokeWidth="1.5" d="m0 0 24 16m0-16L0 16" />
            <path stroke="#fff" strokeWidth="5" d="M12 0v16M0 8h24" />
            <path stroke="#c8102e" strokeWidth="3" d="M12 0v16M0 8h24" />
          </svg>
        )}
        <ChevronDown size={12} />
      </span>
      <select
        key={locale}
        name="language"
        aria-label={messages[locale].language}
        className="language-picker"
        defaultValue={locale}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="az" lang="az">
          Azərbaycanca
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
    </form>
  );
}
