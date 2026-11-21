import type { ReactNode } from "react";
import { LanguageButton } from "@/shared/ui/LanguageButton";
import { BrandMark } from "@/shared/ui/BrandMark";

export function AuthPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4">
      <header className="flex items-center justify-between border-b py-3">
        <BrandMark />
        <LanguageButton />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-6 py-6">
        <section
          aria-labelledby="auth-title"
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
        >
          <h1 id="auth-title" className="text-xl font-semibold">
            {title}
          </h1>
          {children}
        </section>
      </main>
    </div>
  );
}
