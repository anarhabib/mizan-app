import {
  createRootRoute,
  Link,
  Navigate,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/app/Shell";
import { AuthPanel, useSession } from "@/features/auth";
import { WorkspaceProvider } from "@/features/workspace";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { BrandMark } from "@/shared/ui/BrandMark";
import { DocumentTitle } from "@/shared/ui/DocumentTitle";

function RootLayout() {
  const { t } = useTranslation("auth");
  const { userId, ready, recovery } = useSession();
  const { pathname, href } = useRouterState({
    select: (state) => state.location,
  });
  if (pathname === "/auth/callback") return <Outlet />;
  if (recovery) return <Navigate to="/auth/callback" replace />;
  if (pathname === "/login") return <Outlet />;
  if (!ready)
    return (
      <AuthPanel title={t("loading")}>
        <ListSkeleton />
      </AuthPanel>
    );
  if (!userId)
    return <Navigate to="/login" search={{ returnTo: href }} replace />;
  if (pathname === "/invitations/accept") return <Outlet />;
  return (
    <WorkspaceProvider key={userId} userId={userId}>
      <Shell />
    </WorkspaceProvider>
  );
}
function NotFound() {
  const { t } = useTranslation("shell");
  return (
    <div className="grid justify-items-start gap-3 p-6">
      <DocumentTitle title={t("notFound")} />
      <BrandMark />
      <h1>{t("notFound")}</h1>
      <Link to="/" className="underline">
        {t("home")}
      </Link>
    </div>
  );
}
export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});
