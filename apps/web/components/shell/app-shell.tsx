"use client";

import type { StoreContext } from "@mizan/contracts";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { chooseContext } from "../../features/context/context-picker";
import { messages, type Locale } from "../../features/language/messages";
import { membershipCopy } from "../../features/memberships/membership-copy";
import { productCopy } from "../../features/products/product-copy";
import { saleCopy } from "../../features/sales/sale-copy";
import { settingsCopy } from "../../features/settings/settings-copy";
import { Dialog } from "../ui/dialog";
import { GlassHeader } from "./glass-header";
import { MobileDock } from "./mobile-dock";
import { Sidebar, type Destination } from "./sidebar";

export function AppShell({
  contexts,
  dateLabel,
  locale,
  children,
}: {
  contexts: StoreContext[];
  dateLabel: string;
  locale: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const navigationPath = pathname.startsWith("/products/")
    ? "/products"
    : pathname.startsWith("/sales/")
      ? "/sales"
      : pathname;
  const params = useSearchParams();
  const route = pathname + "?" + params.toString();
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let previous = window.scrollY;
    let movement = 0;
    const update = () => {
      const current = window.scrollY;
      const delta = current - previous;
      previous = current;
      if (!delta) return;
      movement =
        Math.sign(delta) === Math.sign(movement) ? movement + delta : delta;
      if (current <= 28 || movement <= -18) setCompact(false);
      else if (current > 54 && movement >= 20) setCompact(true);
    };
    window.addEventListener("scroll", update, { passive: true });
    const desktop = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    const reset = requestAnimationFrame(() => {
      setCompact(false);
      setMenuOpen(false);
    });
    return () => {
      cancelAnimationFrame(reset);
      window.removeEventListener("scroll", update);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [route]);

  const copy = messages[locale];
  const organizationId = params.get("organizationId") ?? undefined;
  const storeId = params.get("storeId") ?? undefined;
  const selected = chooseContext(contexts, organizationId, storeId);
  const owners = contexts.filter(({ role }) => role === "OWNER");
  const ownerScope =
    pathname === "/workspace" && selected
      ? selected.role === "OWNER"
        ? selected.organizationId
        : undefined
      : owners.find((context) => context.organizationId === organizationId)
          ?.organizationId;
  const settingsQuery = ownerScope
    ? "?" +
      new URLSearchParams({
        organizationId: ownerScope,
        ...(selected?.role === "OWNER" && { storeId: selected.storeId }),
      })
    : "";
  const workspaceQuery = selected
    ? "?" +
      new URLSearchParams({
        organizationId: selected.organizationId,
        storeId: selected.storeId,
      })
    : "";
  const destinations: Destination[] = [
    {
      path: "/workspace",
      href: "/workspace" + workspaceQuery,
      label: copy.store,
    },
  ];
  if (contexts.length)
    destinations.push(
      {
        path: "/products",
        href: "/products" + workspaceQuery,
        label: productCopy[locale].title,
      },
      {
        path: "/sales",
        href: "/sales" + workspaceQuery,
        label: saleCopy[locale].history,
      },
    );
  if (
    owners.length &&
    !(pathname === "/workspace" && selected?.role === "SALESPERSON")
  ) {
    destinations.push(
      {
        path: "/settings",
        href: "/settings" + settingsQuery,
        label: settingsCopy[locale].title,
        shortLabel: copy.settingsNav,
      },
      {
        path: "/settings/users",
        href: "/settings/users" + settingsQuery,
        label: membershipCopy[locale].title,
        shortLabel: copy.usersNav,
      },
    );
  }
  const current = destinations.find(({ path }) => path === navigationPath);
  const identity =
    selected?.storeName ??
    owners.find((context) => context.organizationId === ownerScope)
      ?.organizationName;
  const openMenu = () => setMenuOpen(true);

  return (
    <div className="mizan-shell box-border min-h-dvh px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-[761px]:pt-3.5 min-[761px]:pr-4 min-[761px]:pb-4">
      <aside className="mizan-glass-dark fixed inset-y-3.5 left-2 hidden box-border w-49.75 overflow-y-auto rounded-[26px] p-3 min-[761px]:block min-[1001px]:w-57.75">
        <Sidebar
          destinations={destinations}
          pathname={navigationPath}
          locale={locale}
          identity={identity}
          organization={selected?.organizationName}
          workspaceHref={"/workspace" + workspaceQuery}
          dark
        />
      </aside>
      <div>
        <GlassHeader
          title={current?.label ?? copy.store}
          shortTitle={current?.shortLabel}
          locale={locale}
          dateLabel={dateLabel}
          role={
            selected
              ? selected.role === "OWNER"
                ? copy.owner
                : copy.salesperson
              : undefined
          }
          compact={compact}
          openMenu={openMenu}
        />
        <main className="mx-auto min-w-0 max-w-[1520px] pt-4 min-[761px]:px-5 min-[761px]:pt-7 min-[1200px]:px-10">
          {children}
        </main>
      </div>
      <MobileDock
        destinations={destinations}
        pathname={navigationPath}
        locale={locale}
        compact={compact}
        openMenu={openMenu}
      />
      <Dialog
        title={copy.navigation}
        closeLabel={copy.close}
        open={menuOpen}
        placement="side"
        onClose={() => setMenuOpen(false)}
      >
        <Sidebar
          destinations={destinations}
          pathname={navigationPath}
          locale={locale}
          onNavigate={() => setMenuOpen(false)}
        />
      </Dialog>
    </div>
  );
}
