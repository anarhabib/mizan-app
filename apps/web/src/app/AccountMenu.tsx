import { useRef, useState, type ReactNode } from "react";
import {
  Ellipsis,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { DisplayModeControl } from "@/features/settings";
import { useWorkspace } from "@/features/workspace";
import {
  responsiveMenuItem,
  responsiveMenuWidth,
} from "@/shared/ui/responsive-menu";

export function AccountMenu({
  mobile = false,
  active = false,
  concealWorkspace,
  children,
}: {
  mobile?: boolean;
  active?: boolean;
  concealWorkspace: () => void;
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation(["shell", "auth"]);
  const { email, userId } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const { fullName, canManageAsOwner, canSwitchDisplayMode } = useWorkspace();
  const { pending, signOut } = useSignOut();
  const [modeOpen, setModeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const smallScreen = useIsMobile();
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {mobile ? (
            <SidebarMenuButton
              ref={trigger}
              isActive={active}
              className="h-auto min-h-14 flex-col justify-center gap-1 px-0.5 py-2 text-center text-xs leading-tight text-muted-foreground data-active:inset-shadow-[0_-2px_0_var(--brand-accent)]"
            >
              <Ellipsis aria-hidden="true" />
              {t("more")}
            </SidebarMenuButton>
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
          side={mobile ? "top" : "right"}
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
          {children}
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={responsiveMenuItem}>
              <Globe2 aria-hidden="true" />
              <span className="min-w-0 wrap-anywhere">{t("language")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className="min-w-36 max-w-[calc(100dvw-1rem)]"
              collisionPadding={8}
            >
              <DropdownMenuRadioGroup
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
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
      {smallScreen ? (
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
