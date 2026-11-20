import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/features/workspace";
import { PageHeader } from "@/shared/ui/PageHeader";
import type { ProductScope } from "../api/queries";
import { ProductCreate } from "./ProductCreate";
import { ProductDetail } from "./ProductDetail";
import { ProductList } from "./ProductList";

type Panel =
  | { kind: "create"; opener: HTMLElement }
  | { kind: "detail"; id: string; opener: HTMLElement };

export function ProductsPage() {
  const { organizationId, storeId, settings } = useWorkspace();
  const scope = { organizationId, storeId };

  return (
    <ScopedProducts
      key={`${organizationId}/${storeId}`}
      scope={scope}
      currency={settings.defaultCurrency}
    />
  );
}

function ScopedProducts({
  scope,
  currency,
}: {
  scope: ProductScope;
  currency: string;
}) {
  const { t } = useTranslation("products");
  const [panel, setPanel] = useState<Panel>();
  const close = () => setPanel(undefined);

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button
            type="button"
            className="min-h-11 lg:min-h-9"
            onClick={(event) =>
              setPanel({ kind: "create", opener: event.currentTarget })
            }
          >
            <Plus aria-hidden="true" />
            {t("create")}
          </Button>
        }
      />
      <ProductList
        scope={scope}
        inspect={(id, opener) => setPanel({ kind: "detail", id, opener })}
      />
      {panel?.kind === "create" && (
        <ProductCreate
          scope={scope}
          currency={currency}
          opener={panel.opener}
          close={close}
          created={(product) =>
            setPanel({ kind: "detail", id: product.id, opener: panel.opener })
          }
        />
      )}
      {panel?.kind === "detail" && (
        <ProductDetail
          scope={scope}
          id={panel.id}
          opener={panel.opener}
          close={close}
        />
      )}
    </>
  );
}
