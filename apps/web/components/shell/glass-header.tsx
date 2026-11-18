import { Menu } from "lucide-react";
import { BrandMark } from "../brand/brand-mark";
import { Button } from "../ui/button";
import { LanguagePicker } from "../../features/language/language-picker";
import { messages, type Locale } from "../../features/language/messages";

export function GlassHeader({
  title,
  shortTitle = title,
  role,
  dateLabel,
  locale,
  compact,
  openMenu,
}: {
  title: string;
  shortTitle?: string;
  role?: string;
  dateLabel: string;
  locale: Locale;
  compact: boolean;
  openMenu: () => void;
}) {
  return (
    <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-10 h-13.5 min-[761px]:h-15">
      <header
        className={`mizan-header box-border flex items-center justify-between gap-2 rounded-[19px] px-1.5 motion-safe:transition-[height] min-[761px]:px-4 ${compact ? "h-12" : "h-full"}`}
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
          <span className="hidden truncate text-sm font-extrabold min-[761px]:block">
            {title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <time className="hidden text-xs text-mizan-muted min-[1001px]:block">
            {dateLabel}
          </time>
          {role && (
            <span className="hidden text-xs font-bold min-[1001px]:block">
              {role}
            </span>
          )}
          <div className="min-[761px]:hidden">
            <LanguagePicker locale={locale} compact />
          </div>
          <div className="hidden min-[761px]:block">
            <LanguagePicker locale={locale} />
          </div>
        </div>
      </header>
    </div>
  );
}
