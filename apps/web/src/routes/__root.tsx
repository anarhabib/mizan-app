import { createRootRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Shell } from "@/app/Shell";
function NotFound() {
  const { t } = useTranslation("shell");
  return (
    <div className="p-6">
      <h1>{t("notFound")}</h1>
      <Link to="/products" className="underline">
        {t("home")}
      </Link>
    </div>
  );
}
export const Route = createRootRoute({
  component: Shell,
  notFoundComponent: NotFound,
});
