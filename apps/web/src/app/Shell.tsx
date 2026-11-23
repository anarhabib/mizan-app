import { useEffect, useState, type CSSProperties } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ContactRound, Package, Receipt, Settings, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrandMark } from "@/shared/ui/BrandMark";
import { LanguageButton } from "@/shared/ui/LanguageButton";
import { ThemeButton } from "@/shared/ui/ThemeButton";
import { SignOutButton } from "@/features/auth";
import { DisplayModeControl } from "@/features/settings";
import { StoreSwitcher, useWorkspace } from "@/features/workspace";
const items = [
  { to: "/products", namespace: "products", icon: Package },
  { to: "/sales", namespace: "sales", icon: Receipt },
  { to: "/customers", namespace: "customers", icon: ContactRound },
  { to: "/settings", namespace: "settings", icon: Settings, ownerOnly: true },
  { to: "/team", namespace: "team", icon: Users, ownerOnly: true },
] as const;
export function Shell() {
  return (
    <TooltipProvider>
      <SidebarProvider
        className="bg-background"
        style={{ "--sidebar-width": "14rem" } as CSSProperties}
      >
        <ShellContent />
      </SidebarProvider>
    </TooltipProvider>
  );
}

function ShellContent() {
  const workspace = useWorkspace();
  const owner = workspace.canManageAsOwner;
  const { isMobile, open } = useSidebar();
  const [concealed, setConcealed] = useState(false);
  const { t } = useTranslation([
    "shell",
    "products",
    "sales",
    "customers",
    "settings",
    "team",
  ]);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  useEffect(() => {
    document.getElementById("main-content")?.focus();
  }, [pathname]);
  const navigation = !concealed && (
    <nav
      id="main-navigation"
      aria-label={t("navigation")}
      className={
        isMobile
          ? "shell-nav fixed inset-x-0 bottom-0 z-20 border-t bg-card"
          : undefined
      }
    >
      <SidebarMenu
        className={
          isMobile
            ? owner
              ? "grid grid-cols-5 gap-1"
              : "grid grid-cols-3 gap-2"
            : "gap-2"
        }
      >
        {items
          .filter((item) => owner || !("ownerOnly" in item))
          .map(({ to, namespace, icon: Icon }) => {
            const label = t("title", { ns: namespace });
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === to || pathname.startsWith(`${to}/`)}
                  tooltip={isMobile ? undefined : label}
                  className={
                    isMobile
                      ? "h-auto min-h-14 flex-col justify-center gap-1 px-0.5 py-2 text-center text-xs leading-tight text-muted-foreground data-active:inset-shadow-[0_-2px_0_var(--brand-accent)] [&>span:last-child]:overflow-visible [&>span:last-child]:wrap-anywhere [&>span:last-child]:whitespace-normal"
                      : "min-h-9 data-active:inset-shadow-[2px_0_0_var(--brand-accent)] group-data-[collapsible=icon]:min-h-0"
                  }
                >
                  <Link
                    to={to}
                    aria-label={label}
                    activeProps={{ "aria-current": "page" }}
                  >
                    <Icon aria-hidden="true" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {label}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
      </SidebarMenu>
    </nav>
  );
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("skip")}
      </a>
      {!isMobile && (
        <Sidebar collapsible="icon" className="motion-reduce:transition-none">
          <SidebarHeader className="min-h-14 justify-center px-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
            <BrandMark compact={!open} />
          </SidebarHeader>
          <SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
            {navigation}
          </SidebarContent>
        </Sidebar>
      )}
      <div className="min-w-0 flex-1">
        <header className="shell-top border-b border-border bg-card">
          <div className="mx-auto flex min-h-14 max-w-5xl items-center gap-2 px-4">
            {isMobile ? (
              <BrandMark compact />
            ) : (
              <SidebarTrigger
                aria-label={t(open ? "collapseNavigation" : "expandNavigation")}
                aria-controls={concealed ? undefined : "main-navigation"}
                aria-expanded={open}
                title={t(open ? "collapseNavigation" : "expandNavigation")}
              />
            )}
            <div className="min-w-0 flex-1" data-slot="store-switcher">
              {!concealed && (
                <StoreSwitcher
                  active={workspace}
                  contexts={workspace.contexts}
                  onSelect={workspace.selectStore}
                />
              )}
            </div>
            <DisplayModeControl concealWorkspace={() => setConcealed(true)} />
            <ThemeButton />
            <LanguageButton />
            <SignOutButton compact />
          </div>
        </header>
        {isMobile && navigation}
        <main
          id="main-content"
          tabIndex={-1}
          className="shell-content mx-auto max-w-5xl px-4 py-6 focus:outline-none"
        >
          {concealed ? (
            <p role="status">{t("displayMode.concealed")}</p>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </>
  );
}
