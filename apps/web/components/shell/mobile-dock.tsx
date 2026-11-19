import Link from "next/link";
import {
  Ellipsis,
  LayoutGrid,
  Package,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { actionClass, Button } from "../ui/button";
import { messages, type Locale } from "../../features/language/messages";
import type { Destination } from "./sidebar";

const icons = {
  "/workspace": LayoutGrid,
  "/products": Package,
  "/sales": TrendingUp,
  "/settings": Settings,
  "/settings/users": Users,
};

export function MobileDock({
  destinations,
  pathname,
  locale,
  compact,
  scrolled,
  openMenu,
}: {
  destinations: Destination[];
  pathname: string;
  locale: Locale;
  compact: boolean;
  scrolled: boolean;
  openMenu: () => void;
}) {
  const itemClass =
    "min-w-0 flex-1 flex-col gap-0.5 px-1 py-0.5 text-[11px] font-bold";
  return (
    <nav
      aria-label={messages[locale].navigation}
      data-scrolled={scrolled}
      className={`mizan-dock fixed inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-20 mx-auto box-border flex w-[calc(100%-1rem)] items-center gap-0.5 rounded-[19px] px-1 motion-safe:transition-[height,max-width,background-color] min-[761px]:hidden ${compact ? "h-12.75 max-w-82" : "h-16.25 max-w-115"}`}
    >
      {destinations
        .filter(({ path }) => path !== "/settings/users")
        .map(({ path, href, label, shortLabel }) => {
          const Icon = icons[path];
          const active = pathname === path;
          return (
            <Link
              key={path}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={shortLabel ?? label}
              className={`${actionClass} ${itemClass} ${active ? "bg-mizan-selected text-mizan-deep" : "text-mizan-muted"}`}
            >
              <Icon size={18} aria-hidden />
              {!compact && (
                <span className="max-w-full truncate">
                  {shortLabel ?? label}
                </span>
              )}
            </Link>
          );
        })}
      <Button
        variant="secondary"
        onClick={openMenu}
        aria-label={messages[locale].more}
        aria-haspopup="dialog"
        className={`${itemClass} border-transparent bg-transparent`}
      >
        <Ellipsis size={19} aria-hidden />
        {!compact && <span>{messages[locale].more}</span>}
      </Button>
    </nav>
  );
}
