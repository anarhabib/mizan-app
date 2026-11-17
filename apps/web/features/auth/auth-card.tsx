import type { ReactNode } from "react";
import { BrandMark } from "../../components/brand/brand-mark";
import { LanguagePicker } from "../language/language-picker";
import type { Locale } from "../language/messages";
import styles from "./auth-card.module.css";

export function AuthCard({
  title,
  locale,
  wide,
  embedded,
  children,
}: {
  title: string;
  locale: Locale;
  wide?: boolean;
  embedded?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      className={[styles.card, wide && styles.wide, embedded && styles.embedded]
        .filter(Boolean)
        .join(" ")}
    >
      {!embedded && (
        <header>
          <span className="flex items-center gap-2">
            <BrandMark />
            Mizan
          </span>
          <LanguagePicker locale={locale} />
        </header>
      )}
      <section>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
