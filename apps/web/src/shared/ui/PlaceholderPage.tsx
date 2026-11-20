import { useTranslation } from "react-i18next";
import { PageHeader } from "./PageHeader";
import { EmptyState } from "./EmptyState";
export function PlaceholderPage({
  namespace,
}: {
  namespace: "products" | "sales" | "settings" | "team";
}) {
  const { t } = useTranslation(namespace);
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState title={t("empty")} description={t("description")} />
    </>
  );
}
