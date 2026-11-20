import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function LanguageButton() {
  const { t, i18n } = useTranslation("shell");
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 min-w-11 lg:min-h-9"
      aria-label={t("language")}
      onClick={() =>
        void i18n.changeLanguage(i18n.resolvedLanguage === "en" ? "az" : "en")
      }
    >
      {t("otherLanguage")}
    </Button>
  );
}
