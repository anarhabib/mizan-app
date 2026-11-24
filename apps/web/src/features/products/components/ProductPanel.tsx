import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { bindFormDrawerViewport } from "./form-drawer-viewport";

export function ProductPanel({
  title,
  children,
  close,
  opener,
  busy = false,
  descriptionId,
  restoreFallbackFocus,
  mobileFooter,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  opener: HTMLElement;
  busy?: boolean;
  descriptionId?: string;
  restoreFallbackFocus?: () => void;
  mobileFooter?: ReactNode;
}) {
  const mobile = useIsMobile();
  const { t } = useTranslation("products");
  const dismiss = () => {
    if (!busy) close();
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (opener.isConnected) opener.focus({ preventScroll: true });
    else restoreFallbackFocus?.();
  };
  const handleEscape = (event: KeyboardEvent) => {
    if (
      busy ||
      (event.target instanceof Element &&
        event.target.closest("[data-form-panel-escape]"))
    ) {
      event.preventDefault();
    }
  };

  const closeButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={busy}
      onClick={dismiss}
      className="min-h-11 min-w-11 shrink-0 lg:min-h-9 lg:min-w-9"
      aria-label={t("close")}
    >
      <X aria-hidden="true" />
    </Button>
  );
  const body = (
    <div
      data-slot="form-panel-body"
      data-vaul-no-drag={mobile ? "" : undefined}
      className={
        mobileFooter
          ? "min-h-0 flex-auto overflow-y-auto overscroll-y-none px-4 pb-3"
          : "min-h-0 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-lg:overscroll-y-none lg:px-6"
      }
    >
      {children}
    </div>
  );

  if (!mobile) {
    return (
      <Sheet open onOpenChange={dismiss}>
        <SheetContent
          showCloseButton={false}
          aria-describedby={descriptionId}
          onEscapeKeyDown={handleEscape}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onCloseAutoFocus={restoreFocus}
          className="gap-0 data-[side=right]:sm:max-w-lg motion-reduce:animate-none motion-reduce:transition-none"
        >
          <SheetHeader className="flex-row items-center justify-between px-6">
            <SheetTitle className="min-w-0 wrap-anywhere">{title}</SheetTitle>
            {closeButton}
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer
      open
      onOpenChange={dismiss}
      dismissible={!busy}
      repositionInputs={false}
      autoFocus
    >
      <DrawerContent
        ref={bindFormDrawerViewport}
        aria-describedby={descriptionId}
        onEscapeKeyDown={handleEscape}
        onCloseAutoFocus={restoreFocus}
        className="overflow-clip [touch-action:pan-y_pinch-zoom]! after:hidden data-[vaul-drawer-direction=bottom]:bottom-[var(--form-drawer-bottom,0px)] data-[vaul-drawer-direction=bottom]:max-h-[min(85dvh,calc(var(--form-drawer-height,100dvh)-max(0.5rem,env(safe-area-inset-top))))] motion-reduce:animate-none motion-reduce:transition-none"
      >
        <DrawerHeader className="shrink-0 touch-none flex-row items-center justify-between">
          <DrawerTitle className="min-w-0 wrap-anywhere">{title}</DrawerTitle>
          {closeButton}
        </DrawerHeader>
        {body}
        {mobileFooter && (
          <DrawerFooter
            data-vaul-no-drag
            className="shrink-0 gap-2 border-t px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            {mobileFooter}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
