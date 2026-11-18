import type { ReactNode } from "react";
import { BrandMark } from "../../components/brand/brand-mark";
import { PageHeading } from "../../components/ui/page-heading";
import { Surface } from "../../components/ui/surface";
import styles from "../../components/ui/form-controls.module.css";

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-124 box-border content-center gap-3 px-3 py-6">
      <header className="mizan-header flex flex-wrap items-center justify-between gap-2 rounded-[19px] px-4 py-2 sm:px-5">
        <span className="flex items-center gap-2 text-xl font-extrabold">
          <BrandMark />
          Mizan
        </span>
      </header>
      <Surface className="grid min-w-0 gap-4 p-4 sm:p-6">
        <PageHeading title={title} />
        <div className={styles.controls}>{children}</div>
      </Surface>
    </main>
  );
}
