import { useRef, useState } from "react";
import {
  Globe2,
  LogOut,
  Moon,
  Shield,
  Sun,
  UserRound,
  UserRoundPen,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ProfileForm, useSession, useSignOut } from "@/features/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DisplayModeControl } from "@/features/settings";
import { useWorkspace } from "@/features/workspace";
import {
  responsiveMenuItem,
  responsiveMenuWidth,
} from "@/shared/ui/responsive-menu";

export function AccountMenu({
  mobile = false,
  concealWorkspace,
}: {
  mobile?: boolean;
  concealWorkspace: () => void;
}) {
  const { t, i18n } = useTranslation(["shell", "auth"]);
  const { email, userId } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const { fullName, canManageAsOwner, canSwitchDisplayMode } = useWorkspace();
  const { pending, signOut } = useSignOut();
  const [modeOpen, setModeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const initials = mobile
    ? accountInitials(fullName, i18n.resolvedLanguage)
    : "";
  const trigger = useRef<HTMLButtonElement>(null);
  const role = t(
    canManageAsOwner ? "displayMode.owner" : "displayMode.salesperson",
  );
  const dark = resolvedTheme === "dark";
  const ThemeIcon = dark ? Sun : Moon;
  const title = t("editProfile", { ns: "auth" });
  const closeProfile = () => setProfileOpen(false);
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };
  const form = profileOpen && userId && (
    <ProfileForm
      userId={userId}
      fullName={fullName}
      edited={closeProfile}
      cancel={closeProfile}
    />
  );
  const languages = (
    <DropdownMenuRadioGroup
      aria-label={t("language")}
      value={i18n.resolvedLanguage ?? "az"}
      onValueChange={(value) => void i18n.changeLanguage(value)}
    >
      {(["az", "en", "ru"] as const).map((language) => (
        <DropdownMenuRadioItem
          key={language}
          value={language}
          className="min-h-10"
        >
          {t(`languageOptions.${language}`)}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {mobile ? (
            <Button
              ref={trigger}
              type="button"
              variant="outline"
              aria-label={t("account")}
              className="size-11 shrink-0 rounded-full bg-muted p-0 font-semibold"
            >
              {initials ? (
                <span aria-hidden="true">{initials}</span>
              ) : (
                <UserRound aria-hidden="true" />
              )}
            </Button>
          ) : (
            <SidebarMenuButton
              ref={trigger}
              size="lg"
              aria-label={t("account")}
              tooltip={t("account")}
              className="group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center"
            >
              <UserRound aria-hidden="true" />
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="block truncate font-medium">{fullName}</span>
                <span className="block text-xs text-muted-foreground">
                  {role}
                </span>
              </span>
            </SidebarMenuButton>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={mobile ? "bottom" : "right"}
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className={responsiveMenuWidth}
          onCloseAutoFocus={(event) => {
            if (modeOpen || profileOpen) event.preventDefault();
          }}
        >
          <DropdownMenuLabel className="min-w-0 wrap-anywhere">
            <span className="block">{fullName}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {role}
            </span>
            {email && (
              <span className="block text-xs font-normal text-muted-foreground">
                {email}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={responsiveMenuItem}
            onSelect={() => setProfileOpen(true)}
          >
            <UserRoundPen aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">{title}</span>
          </DropdownMenuItem>
          {canSwitchDisplayMode && (
            <DropdownMenuItem
              className={responsiveMenuItem}
              onSelect={() => setModeOpen(true)}
            >
              <Shield aria-hidden="true" />
              <span className="min-w-0 wrap-anywhere">
                {t("displayMode.change")}
              </span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className={responsiveMenuItem}
            onSelect={() => setTheme(dark ? "light" : "dark")}
          >
            <ThemeIcon aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">
              {t(dark ? "theme.switchToLight" : "theme.switchToDark")}
            </span>
          </DropdownMenuItem>
          {mobile ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t("language")}
              </DropdownMenuLabel>
              {languages}
            </>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={responsiveMenuItem}>
                <Globe2 aria-hidden="true" />
                <span className="min-w-0 wrap-anywhere">{t("language")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent
                  className="pointer-events-auto min-w-36 max-w-[calc(100dvw-1rem)]"
                  collisionPadding={8}
                >
                  {languages}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={responsiveMenuItem}
            disabled={pending}
            onSelect={() => void signOut()}
          >
            <LogOut aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">
              {t("signOut", { ns: "auth" })}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {mobile ? (
        <Drawer open={profileOpen} onOpenChange={setProfileOpen} autoFocus>
          <DrawerContent
            aria-describedby={undefined}
            onCloseAutoFocus={restoreFocus}
          >
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {form}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
          <SheetContent
            aria-describedby={undefined}
            showCloseButton={false}
            onCloseAutoFocus={restoreFocus}
          >
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{form}</div>
          </SheetContent>
        </Sheet>
      )}
      <DisplayModeControl
        concealWorkspace={concealWorkspace}
        open={modeOpen}
        onOpenChange={setModeOpen}
        restoreFocus={() => trigger.current?.focus()}
      />
    </>
  );
}

function accountInitials(fullName: string | null | undefined, locale?: string) {
  const letters = (fullName ?? "").split(/\s+/u).flatMap((word) => {
    const initial = word.match(/\p{L}\p{M}*/u)?.[0];
    return initial ? [initial] : [];
  });
  const first = letters[0] ?? "";
  return (
    letters.length > 1 ? first + letters.at(-1) : first
  ).toLocaleUpperCase(locale);
}
