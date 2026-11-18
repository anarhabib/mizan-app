import Link from "next/link";
import {
  ChevronDown,
  LayoutGrid,
  Package,
  LogOut,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { BrandMark } from "../brand/brand-mark";
import { actionClass, Button } from "../ui/button";
import { signOut } from "../../features/auth/owner-actions";
import { messages, type Locale } from "../../features/language/messages";

export type Destination = {
  path: "/workspace" | "/products" | "/sales" | "/settings" | "/settings/users";
  href: string;
  label: string;
  shortLabel?: string;
};

const icons = {
  "/workspace": LayoutGrid,
  "/products": Package,
  "/sales": TrendingUp,
  "/settings": Settings,
  "/settings/users": Users,
};

export function Sidebar({
  destinations,
  pathname,
  locale,
  identity,
  organization,
  workspaceHref = "/workspace",
  dark = false,
  onNavigate,
}: {
  destinations: Destination[];
  pathname: string;
  locale: Locale;
  identity?: string;
  organization?: string;
  workspaceHref?: string;
  dark?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col gap-4">
      {dark && (
        <div className="flex min-w-0 items-center gap-2.5 px-1.5 pt-2">
          <BrandMark />
          <div className="min-w-0 wrap-break-word">
            <strong className="block text-xl leading-tight">Mizan</strong>
            <span className="text-[11px] text-mizan-dark-muted">
              {locale === "az" ? "Mağaza idarəetməsi" : "Store management"}
            </span>
          </div>
        </div>
      )}
      {dark && identity && (
        <Link
          href={workspaceHref}
          className={
            actionClass +
            " justify-start border-mizan-pale/30 bg-white/10 px-2 text-mizan-dark-text focus-visible:outline-mizan-pale"
          }
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-mizan-pale text-mizan-deep"
          >
            {(organization || identity).slice(0, 1).toLocaleUpperCase(locale)}
          </span>
          <span className="min-w-0 flex-1 wrap-anywhere">
            <strong className="block text-xs">
              {organization || identity}
            </strong>
            {organization && (
              <span className="block text-[11px] text-mizan-dark-muted">
                {identity}
              </span>
            )}
          </span>
          <ChevronDown size={13} aria-hidden />
        </Link>
      )}
      {dark && (
        <p className="m-0 px-2 text-[10px] font-extrabold tracking-wide text-mizan-dark-muted uppercase">
          {locale === "az" ? "Mağaza dəftəri" : "Store ledger"}
        </p>
      )}
      <nav
        aria-label={messages[locale].navigation}
        className={dark ? "flex flex-1 flex-col gap-1.5" : "grid gap-1.5"}
      >
        {destinations.map(({ path, href, label }) => {
          const Icon = icons[path];
          const active = pathname === path;
          return (
            <Link
              key={path}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`${actionClass} justify-start ${dark && path === "/settings" ? "mt-auto" : ""} ${active ? "bg-mizan-inverse text-mizan-deep" : dark ? "text-mizan-dark-text hover:bg-mizan-deep" : "text-mizan-ink hover:bg-mizan-selected"} ${dark ? "focus-visible:outline-mizan-pale" : ""}`}
            >
              <Icon size={18} className="shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <form action={signOut} className="m-0 border-t border-mizan-edge/30 pt-3">
        <Button type="submit" variant={dark ? "inverse" : "secondary"}>
          <LogOut size={18} aria-hidden />
          {messages[locale].signOut}
        </Button>
      </form>
    </div>
  );
}
