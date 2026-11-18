import { Menu } from "lucide-react";
import { BrandMark } from "../brand/brand-mark";
import { Button } from "../ui/button";
import { messages, type Locale } from "../../features/language/messages";

export function GlassHeader({
  title,
  shortTitle = title,
  role,
  dateLabel,
  locale,
  scrolled,
  openMenu,
}: {
  title: string;
  shortTitle?: string;
  role?: string;
  dateLabel: string;
  locale: Locale;
  scrolled: boolean;
  openMenu: () => void;
}) {
  return (
    <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-10 h-13.5 min-[761px]:h-15">
      <header
        className="mizan-header box-border flex h-full items-center justify-between gap-2 rounded-[19px] px-1.5 motion-safe:transition-colors min-[761px]:px-4"
        data-scrolled={scrolled}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            variant="secondary"
            onClick={openMenu}
            aria-label={messages[locale].navigation}
            aria-haspopup="dialog"
            className="border-transparent bg-transparent px-0 min-[761px]:hidden"
          >
            <Menu size={21} aria-hidden />
          </Button>
          <BrandMark className="max-[359px]:hidden min-[761px]:hidden" />
          <span className="truncate text-sm font-extrabold min-[761px]:hidden">
            {shortTitle}
          </span>
          <span className="hidden items-center gap-2.5 truncate text-xs min-[761px]:flex">
            <span className="text-mizan-muted">
              {locale === "az" ? "İdarəetmə" : "Management"}
            </span>
            <span aria-hidden className="text-mizan-edge">
              /
            </span>
            <strong>{title}</strong>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <time className="hidden text-xs text-mizan-muted min-[1001px]:block">
            {dateLabel}
          </time>
          {role && (
            <span className="hidden items-center gap-2.5 border-l border-mizan-edge/40 pl-4 text-xs font-bold min-[761px]:flex">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-full bg-mizan-pale text-[10px] font-extrabold text-mizan-deep"
              >
                {role
                  .split(" ")
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")
                  .toLocaleUpperCase(locale)}
              </span>
              {role}
            </span>
          )}
        </div>
      </header>
    </div>
  );
}
