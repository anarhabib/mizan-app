import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/features/workspace";
import { PageHeader } from "@/shared/ui/PageHeader";
import type { ProductFilters, ProductScope } from "../api/queries";
import { ProductCreate } from "./ProductCreate";
import { ProductDetail } from "./ProductDetail";
import { ProductList } from "./ProductList";
import { InventoryOverview } from "./InventoryOverview";
import { JewelrySets } from "./JewelrySets";
import { ProductsNavigation } from "./ProductsNavigation";

type Panel =
  | { kind: "create"; opener: HTMLElement }
  | { kind: "detail"; id: string; opener: HTMLElement };

type Props = {
  product?: string;
  intent?: "create" | "sale";
  view?: "sets";
  filters?: Pick<
    ProductFilters,
    "status" | "soldOn" | "receivedOn" | "agedDays" | "credit"
  >;
  clearDashboardFilters?: () => void;
  closeLinkedProduct: () => void;
  startSale: (id: string) => void;
};

export function ProductsPage(props: Props) {
  const { organizationId, storeId, settings, canManageAsOwner } =
    useWorkspace();
  const scope = { organizationId, storeId };
  if (props.view === "sets")
    return (
      <JewelrySets
        key={`${organizationId}/${storeId}`}
        scope={scope}
        owner={canManageAsOwner}
      />
    );

  return (
    <ScopedProducts
      key={`${organizationId}/${storeId}`}
      scope={scope}
      currency={settings.defaultCurrency}
      owner={canManageAsOwner}
      {...props}
    />
  );
}

function ScopedProducts({
  scope,
  currency,
  owner,
  product,
  intent,
  filters,
  clearDashboardFilters,
  closeLinkedProduct,
  startSale,
}: {
  scope: ProductScope;
  currency: string;
  owner: boolean;
} & Props) {
  const { t } = useTranslation("products");
  const { t: dashboard } = useTranslation("dashboard");
  const [panel, setPanel] = useState<Panel>();
  const [overviewSelection, setOverviewSelection] = useState(0);
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
      {intent !== "sale" && <ProductsNavigation />}
      {intent === "sale" ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {dashboard("selectForSale")}
        </p>
      ) : (
        <InventoryOverview
          scope={scope}
          owner={owner}
          onSelect={() => setOverviewSelection((current) => current + 1)}
        />
      )}
      <ProductList
        scope={scope}
        key={JSON.stringify([
          intent,
          filters?.status,
          filters?.credit,
          Boolean(filters?.receivedOn),
          overviewSelection,
        ])}
        initialStatus={
          filters?.credit
            ? "SOLD_ON_CREDIT"
            : (filters?.status ?? (filters?.receivedOn ? "all" : "IN_STOCK"))
        }
        dashboardFilters={filters}
        clearDashboardFilters={clearDashboardFilters}
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
          key={current.id}
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
