import { useEffect, useState, type CSSProperties } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ContactRound,
  Ellipsis,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Truck,
  // Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandMark } from "@/shared/ui/BrandMark";
import { PageContainer } from "@/shared/ui/PageContainer";
import {
  responsiveMenuItem,
  responsiveMenuWidth,
} from "@/shared/ui/responsive-menu";
import { AccountMenu } from "./AccountMenu";
import { StoreSwitcher, useWorkspace } from "@/features/workspace";
const settingsItem = {
  to: "/settings",
  namespace: "settings",
  icon: Settings,
  ownerOnly: true,
} as const;
const items = [
  { to: "/", namespace: "dashboard", icon: LayoutDashboard },
  { to: "/products", namespace: "products", icon: Package },
  { to: "/sales", namespace: "sales", icon: Receipt },
  { to: "/customers", namespace: "customers", icon: ContactRound },
  { to: "/suppliers", namespace: "suppliers", icon: Truck, ownerOnly: true },
  settingsItem,
  // { to: "/team", namespace: "team", icon: Users, ownerOnly: true },
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
    "dashboard",
    "products",
    "sales",
    "customers",
    "suppliers",
    "settings",
    "team",
  ]);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  useEffect(() => {
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
  const width =
    pathname === "/settings" || pathname === "/team" ? "standard" : "wide";
  const concealWorkspace = () => setConcealed(true);
  function navigationItem({
    to,
    namespace,
    icon: Icon,
  }: (typeof items)[number]) {
    const label =
      namespace === "dashboard"
        ? t("nav", { ns: "dashboard" })
        : t("title", { ns: namespace });
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
            activeOptions={{ exact: to === "/" }}
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
  }
  const navigation = (
    <nav
      id="main-navigation"
      aria-label={t("navigation")}
      className={
        isMobile
          ? "shell-nav fixed inset-x-0 bottom-0 z-20 border-t bg-card"
          : undefined
      }
    >
      <SidebarMenu className={isMobile ? "grid grid-cols-5 gap-1" : "gap-2"}>
        {!concealed &&
          items
            .filter(
              (item) =>
                !("ownerOnly" in item) ||
                (owner && !isMobile && item !== settingsItem),
            )
            .map(navigationItem)}
        {isMobile && (
          <SidebarMenuItem className="col-start-5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  isActive={items.some(
                    (item) => "ownerOnly" in item && item.to === pathname,
                  )}
                  className="h-auto min-h-14 flex-col justify-center gap-1 px-0.5 py-2 text-center text-xs leading-tight text-muted-foreground data-active:inset-shadow-[0_-2px_0_var(--brand-accent)]"
                >
                  <Ellipsis aria-hidden="true" />
                  {t("more")}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                sideOffset={8}
                collisionPadding={8}
                className={responsiveMenuWidth}
              >
                {owner && !concealed ? (
                  items
                    .filter((item) => "ownerOnly" in item)
                    .map(({ to, namespace, icon: Icon }) => (
                      <DropdownMenuItem
                        key={to}
                        asChild
                        className={responsiveMenuItem}
                      >
                        <Link to={to} activeProps={{ "aria-current": "page" }}>
                          <Icon aria-hidden="true" />
                          <span className="min-w-0 wrap-anywhere">
                            {t("title", { ns: namespace })}
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    ))
                ) : (
                  <DropdownMenuLabel className="wrap-anywhere font-normal text-muted-foreground">
                    {t("noMoreNavigation")}
                  </DropdownMenuLabel>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        )}
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
          <SidebarHeader className="min-h-14 flex-row items-center justify-between px-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <BrandMark compact={!open} />
            <SidebarTrigger
              className="shrink-0"
              aria-label={t(open ? "collapseNavigation" : "expandNavigation")}
              aria-controls={concealed ? undefined : "main-navigation"}
              aria-expanded={open}
              title={t(open ? "collapseNavigation" : "expandNavigation")}
            />
          </SidebarHeader>
          <SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
            {!concealed && navigation}
          </SidebarContent>
          <SidebarFooter className="border-t group-data-[collapsible=icon]:items-center">
            <SidebarMenu className="gap-1">
              {owner && !concealed && navigationItem(settingsItem)}
              <SidebarMenuItem>
                <AccountMenu concealWorkspace={concealWorkspace} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      )}
      <div className="min-w-0 flex-1">
        <header className="shell-top border-b border-border bg-card">
          <PageContainer
            width={width}
            className="flex min-h-14 items-center gap-2"
          >
            {isMobile && <BrandMark compact />}
            <div className="min-w-0 flex-1" data-slot="store-switcher">
              {!concealed && (
                <StoreSwitcher
                  active={workspace}
                  contexts={workspace.contexts}
                  onSelect={workspace.selectStore}
                />
              )}
            </div>
            {isMobile && (
              <AccountMenu mobile concealWorkspace={concealWorkspace} />
            )}
          </PageContainer>
        </header>
        {isMobile && navigation}
        <main
          id="main-content"
          tabIndex={-1}
          className="shell-content py-6 focus:outline-none"
        >
          <PageContainer width={width}>
            {concealed ? (
              <p role="status">{t("displayMode.concealed")}</p>
            ) : (
              <Outlet />
            )}
          </PageContainer>
        </main>
      </div>
    </>
  );
}
