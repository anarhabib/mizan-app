import type { ReactNode } from "react";
import { LanguagePicker } from "../language/language-picker";
import type { Locale } from "../language/messages";
import styles from "./auth-card.module.css";

export function AuthCard({
  title,
  locale,
  wide,
  children,
}: {
  title: string;
  locale: Locale;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={wide ? `${styles.card} ${styles.wide}` : styles.card}>
      <header>
        <span>Mizan</span>
        <LanguagePicker locale={locale} />
      </header>
      <section>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
