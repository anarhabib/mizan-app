import { useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const desktopQuery = "(min-width: 64rem)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const isDesktop = () => window.matchMedia(desktopQuery).matches;

export function useProductDesktop() {
  return useSyncExternalStore(subscribe, isDesktop, () => false);
}

export function ProductPanel({
  title,
  children,
  close,
  opener,
  busy = false,
  descriptionId,
  restoreFallbackFocus,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  opener: HTMLElement;
  busy?: boolean;
  descriptionId?: string;
  restoreFallbackFocus?: () => void;
}) {
  const desktop = useProductDesktop();
  const { t } = useTranslation("products");
  const dismiss = () => {
    if (!busy) close();
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (opener.isConnected) opener.focus();
    else restoreFallbackFocus?.();
  };

  const closeButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={busy}
      onClick={dismiss}
      className="min-h-11 min-w-11 lg:min-h-9 lg:min-w-9"
      aria-label={t("close")}
    >
      <X aria-hidden="true" />
    </Button>
  );
  const body = (
    <div className="min-h-0 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:px-6">
      {children}
    </div>
  );

  if (desktop) {
    return (
      <Sheet open onOpenChange={dismiss}>
        <SheetContent
          showCloseButton={false}
          aria-describedby={descriptionId}
          onCloseAutoFocus={restoreFocus}
          className="gap-0 data-[side=right]:sm:max-w-lg motion-reduce:animate-none motion-reduce:transition-none"
        >
          <SheetHeader className="flex-row items-center justify-between px-6">
            <SheetTitle>{title}</SheetTitle>
            {closeButton}
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer open onOpenChange={dismiss} dismissible={!busy} autoFocus>
      <DrawerContent
        aria-describedby={descriptionId}
        onCloseAutoFocus={restoreFocus}
        className="data-[vaul-drawer-direction=bottom]:max-h-[85dvh] motion-reduce:animate-none motion-reduce:transition-none"
      >
        <DrawerHeader className="flex-row items-center justify-between">
          <DrawerTitle>{title}</DrawerTitle>
          {closeButton}
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
}
