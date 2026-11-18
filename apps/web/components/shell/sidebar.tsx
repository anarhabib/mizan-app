import Link from "next/link";
import { LogOut, Settings, Store, Users } from "lucide-react";
import { BrandMark } from "../brand/brand-mark";
import { actionClass, Button } from "../ui/button";
import { signOut } from "../../features/auth/owner-actions";
import { messages, type Locale } from "../../features/language/messages";

export type Destination = {
  path: "/workspace" | "/settings" | "/settings/users";
  href: string;
  label: string;
  shortLabel?: string;
};

const icons = {
  "/workspace": Store,
  "/settings": Settings,
  "/settings/users": Users,
};

export function Sidebar({
  destinations,
  pathname,
  locale,
  identity,
  dark = false,
  onNavigate,
}: {
  destinations: Destination[];
  pathname: string;
  locale: Locale;
  identity?: string;
  dark?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="grid gap-4">
      {dark && (
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark />
          glass-header.tsx
          <div className="min-w-0 wrap-break-word">
            <strong className="block">Mizan</strong>
            {identity && (
              <span className="text-xs text-mizan-dark-muted">{identity}</span>
            )}
          </div>
        </div>
      )}
      <nav aria-label={messages[locale].navigation} className="grid gap-1.5">
        {destinations.map(({ path, href, label }) => {
          const Icon = icons[path];
          const active = pathname === path;
          return (
            <Link
              key={path}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`${actionClass} justify-start ${active ? "bg-mizan-inverse text-mizan-deep" : dark ? "text-mizan-dark-text hover:bg-mizan-deep" : "text-mizan-ink hover:bg-mizan-selected"} ${dark ? "focus-visible:outline-mizan-pale" : ""}`}
            >
              <Icon size={18} className="shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <form action={signOut} className="m-0">
        <Button type="submit" variant={dark ? "inverse" : "secondary"}>
          <LogOut size={18} aria-hidden />
          {messages[locale].signOut}
        </Button>
      </form>
    </div>
  );
}
