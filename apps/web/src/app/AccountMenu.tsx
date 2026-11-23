import { useRef, useState, type ReactNode } from "react";
import {
  Ellipsis,
  Globe2,
  LogOut,
  Moon,
  Shield,
  Sun,
  UserRound,
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
import { useSession, useSignOut } from "@/features/auth";
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
  const { email } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const { canManageAsOwner, canSwitchDisplayMode } = useWorkspace();
  const { pending, signOut } = useSignOut();
  const [modeOpen, setModeOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const role = t(
    canManageAsOwner ? "displayMode.owner" : "displayMode.salesperson",
  );
  const dark = resolvedTheme === "dark";
  const ThemeIcon = dark ? Sun : Moon;

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
                <span className="block truncate font-medium">
                  {email ?? t("account")}
                </span>
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
            if (modeOpen) event.preventDefault();
          }}
        >
          <DropdownMenuLabel className="min-w-0 wrap-anywhere">
            <span className="block">{email ?? t("account")}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {role}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {children}
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
      <DisplayModeControl
        concealWorkspace={concealWorkspace}
        open={modeOpen}
        onOpenChange={setModeOpen}
        restoreFocus={() => trigger.current?.focus()}
      />
    </>
  );
}
