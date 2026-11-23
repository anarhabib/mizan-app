import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";
import { LanguageButton } from "@/shared/ui/LanguageButton";
import { BrandMark } from "@/shared/ui/BrandMark";
import { DocumentTitle } from "@/shared/ui/DocumentTitle";

export function AuthPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4">
      <DocumentTitle title={title} />
      <header className="flex items-center justify-between border-b py-3">
        <BrandMark />
        <LanguageButton />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-6 py-6">
        <Card
          role="region"
          aria-labelledby="auth-title"
          className="gap-4 rounded-lg border p-6 ring-0"
        >
          <h1 id="auth-title" className="text-xl font-semibold">
            {title}
          </h1>
          {children}
        </Card>
      </main>
    </div>
  );
}
