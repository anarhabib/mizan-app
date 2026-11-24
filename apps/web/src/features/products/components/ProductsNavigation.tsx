import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function ProductsNavigation({ view }: { view?: "sets" }) {
  const { t } = useTranslation("products");
  return (
    <nav aria-label={t("title")} className="mb-4 flex flex-wrap gap-2">
      <Button
        asChild
        variant={view ? "outline" : "secondary"}
        className="min-h-11 lg:min-h-9"
      >
        <Link
          to="/products"
          aria-current={view ? undefined : "page"}
          activeOptions={{
            exact: true,
            includeSearch: true,
            explicitUndefined: true,
          }}
          search={{ view: undefined }}
        >
          {t("title")}
        </Link>
      </Button>
      <Button
        asChild
        variant={view ? "secondary" : "outline"}
        className="min-h-11 lg:min-h-9"
      >
        <Link
          to="/products"
          search={{ view: "sets" }}
          aria-current={view ? "page" : undefined}
        >
          {t("sets.title")}
        </Link>
      </Button>
    </nav>
  );
}
