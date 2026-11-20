import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation("shell");
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 min-w-11 lg:min-h-9"
      aria-label={t(isDark ? "theme.switchToLight" : "theme.switchToDark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}
