import { lazy, Suspense, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { queryClient } from "./query-client";
import { SessionProvider } from "@/features/auth";
import { Toaster } from "@/components/ui/sonner";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;

function DesktopDevtools() {
  const mobile = useIsMobile();
  if (mobile || !Devtools) return null;
  return (
    <Suspense fallback={null}>
      <Devtools initialIsOpen={false} buttonPosition="top-right" />
    </Suspense>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const { t } = useTranslation("shell");
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
        <Toaster
          position="top-center"
          containerAriaLabel={t("notifications")}
        />
        {Devtools && <DesktopDevtools />}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
