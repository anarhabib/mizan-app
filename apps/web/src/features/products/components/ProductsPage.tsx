import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ExchangeRateWidget } from "@/features/exchange-rates";
import { GoldMarketWidget } from "@/features/gold-prices";
import { useWorkspace } from "@/features/workspace";
import { PageHeader } from "@/shared/ui/PageHeader";
import type { ProductScope } from "../api/queries";
import { ProductCreate } from "./ProductCreate";
import { ProductDetail } from "./ProductDetail";
import { ProductList } from "./ProductList";

type Panel =
  | { kind: "create"; opener: HTMLElement }
  | { kind: "detail"; id: string; opener: HTMLElement };

type Props = {
  product?: string;
  intent?: "create" | "sale";
  closeLinkedProduct: () => void;
  startSale: (id: string) => void;
};

export function ProductsPage(props: Props) {
  const { organizationId, storeId, settings } = useWorkspace();
  const scope = { organizationId, storeId };

  return (
    <ScopedProducts
      key={`${organizationId}/${storeId}`}
      scope={scope}
      currency={settings.defaultCurrency}
      {...props}
    />
  );
}

function ScopedProducts({
  scope,
  currency,
  product,
  intent,
  closeLinkedProduct,
  startSale,
}: {
  scope: ProductScope;
  currency: string;
} & Props) {
  const { t } = useTranslation("products");
  const { t: dashboard } = useTranslation("dashboard");
  const [panel, setPanel] = useState<Panel>();
  const [createButton, setCreateButton] = useState<HTMLButtonElement | null>(
    null,
  );
  const current =
    panel ??
    (createButton &&
      (product
        ? { kind: "detail" as const, id: product, opener: createButton }
        : intent === "create"
          ? { kind: "create" as const, opener: createButton }
          : undefined));
  const close = () => {
    setPanel(undefined);
    if (product || intent === "create") closeLinkedProduct();
  };

  return (
    <>
      <PageHeader
        title={intent === "sale" ? dashboard("recordSale") : t("title")}
        actions={
          <Button
            type="button"
            ref={setCreateButton}
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
      {intent === "sale" ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {dashboard("selectForSale")}
        </p>
      ) : (
        <>
          <ExchangeRateWidget scope={scope} />
          <GoldMarketWidget scope={scope} />
        </>
      )}
      <ProductList
        scope={scope}
        onlyInStock={intent === "sale"}
        inspect={(id, opener) =>
          intent === "sale"
            ? startSale(id)
            : setPanel({ kind: "detail", id, opener })
        }
      />
      {current?.kind === "create" && (
        <ProductCreate
          scope={scope}
          currency={currency}
          opener={current.opener}
          close={close}
          created={(product) =>
            setPanel({ kind: "detail", id: product.id, opener: current.opener })
          }
        />
      )}
      {current?.kind === "detail" && (
        <ProductDetail
          scope={scope}
          id={current.id}
          restoreFallbackFocus={() => createButton?.focus()}
          opener={current.opener}
          close={close}
        />
      )}
    </>
  );
}
