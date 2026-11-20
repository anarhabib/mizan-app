import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageButton() {
  const { t, i18n } = useTranslation("shell");
  const language = i18n.resolvedLanguage ?? "az";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-11 lg:min-h-9"
          aria-label={t("language")}
        >
          {language.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-38">
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(value) => void i18n.changeLanguage(value)}
        >
          <DropdownMenuRadioItem value="az">
            {t("languageOptions.az")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">
            {t("languageOptions.en")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="ru">
            {t("languageOptions.ru")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
