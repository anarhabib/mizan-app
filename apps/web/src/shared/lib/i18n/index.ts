import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import azshell from "@/locales/az/shell.json";
import enshell from "@/locales/en/shell.json";
import azproducts from "@/locales/az/products.json";
import enproducts from "@/locales/en/products.json";
import azsales from "@/locales/az/sales.json";
import ensales from "@/locales/en/sales.json";
import azsettings from "@/locales/az/settings.json";
import ensettings from "@/locales/en/settings.json";
import azteam from "@/locales/az/team.json";
import enteam from "@/locales/en/team.json";
import azerrors from "@/locales/az/errors.json";
import enerrors from "@/locales/en/errors.json";

export const resources = {
  az: {
    shell: azshell,
    products: azproducts,
    sales: azsales,
    settings: azsettings,
    team: azteam,
    errors: azerrors,
  },
  en: {
    shell: enshell,
    products: enproducts,
    sales: ensales,
    settings: ensettings,
    team: enteam,
    errors: enerrors,
  },
} as const;
void i18n.use(initReactI18next).init({
  resources,
  lng: "az",
  fallbackLng: "az",
  defaultNS: "shell",
  interpolation: { escapeValue: false },
});
export default i18n;
