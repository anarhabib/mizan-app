import { useEffect, type ReactNode } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Package, Receipt, Settings, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/shared/ui/BrandMark";
const items = [
  { to: "/products", namespace: "products", icon: Package },
  { to: "/sales", namespace: "sales", icon: Receipt },
  { to: "/settings", namespace: "settings", icon: Settings },
  { to: "/team", namespace: "team", icon: Users },
] as const;
export function Shell({ storeSwitcher }: { storeSwitcher?: ReactNode }) {
  const { t, i18n } = useTranslation([
    "shell",
    "products",
    "sales",
    "settings",
    "team",
  ]);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? "az";
  }, [i18n.resolvedLanguage]);
  useEffect(() => {
    document.getElementById("main-content")?.focus();
  }, [pathname]);
  return (
    <div className="min-h-dvh bg-background text-foreground lg:pl-56">
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("skip")}
      </a>
      <div className="fixed inset-y-0 left-0 hidden w-56 border-r bg-sidebar p-6 lg:block">
        <BrandMark />
      </div>
      <header className="shell-top border-b bg-background">
        <div className="mx-auto flex min-h-14 max-w-5xl items-center gap-3 px-4">
          <span className="lg:hidden">
            <BrandMark />
          </span>
          <div className="min-w-0 flex-1" data-slot="store-switcher">
            {storeSwitcher}
          </div>
          <Button
            variant="outline"
            className="min-h-11 min-w-11 lg:min-h-9"
            aria-label={t("language")}
            onClick={() => {
              void i18n.changeLanguage(
                i18n.resolvedLanguage === "en" ? "az" : "en",
              );
            }}
          >
            {t("otherLanguage")}
          </Button>
        </div>
      </header>
      <nav
        aria-label={t("navigation")}
        className="shell-nav fixed inset-x-0 bottom-0 z-20 border-t bg-background lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:top-20 lg:w-56 lg:border-0 lg:bg-sidebar lg:p-4"
      >
        <ul className="grid grid-cols-4 gap-2 lg:flex lg:flex-col">
          {items.map(({ to, namespace, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeProps={{ "aria-current": "page" }}
                className="flex min-h-14 flex-col items-center justify-center gap-2 rounded-md px-2 py-3 text-xs text-muted-foreground outline-offset-2 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring lg:min-h-11 lg:flex-row lg:justify-start lg:px-3 lg:text-sm [&[aria-current=page]]:bg-primary [&[aria-current=page]]:font-semibold [&[aria-current=page]]:text-primary-foreground [&[aria-current=page]]:underline [&[aria-current=page]]:underline-offset-4"
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{t("title", { ns: namespace })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main
        id="main-content"
        tabIndex={-1}
        className="shell-content mx-auto max-w-5xl px-4 py-6 focus:outline-none"
      >
        <Outlet />
      </main>
    </div>
  );
}
