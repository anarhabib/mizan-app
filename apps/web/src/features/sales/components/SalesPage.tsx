import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ProductPanel } from "@/features/products";
import { useWorkspace } from "@/features/workspace";
import { PageHeader } from "@/shared/ui/PageHeader";
import type { SaleFilters, SaleScope } from "../api/queries";
import { SaleCreate, type SetSaleTarget } from "./SaleCreate";
import { SaleList } from "./SaleList";
import { SaleDetail } from "./SaleResult";
import { SaleSetPicker } from "./SaleSetPicker";

type CreateTarget = {
  productId?: string;
  setTarget?: SetSaleTarget;
  saleId?: string;
  closeCreate: () => void;
  filters?: Omit<SaleFilters, "q">;
  setFilters?: (filters: Omit<SaleFilters, "q">) => void;
};

export function SalesPage(props: CreateTarget) {
  const { organizationId, storeId } = useWorkspace();
  return (
    <ScopedSales
      key={`${organizationId}/${storeId}`}
      scope={{ organizationId, storeId }}
      {...props}
    />
  );
}

function ScopedSales({
  scope,
  productId,
  setTarget,
  saleId,
  closeCreate,
  filters,
  setFilters,
}: CreateTarget & { scope: SaleScope }) {
  const { t } = useTranslation("sales");
  const [focusTarget, setFocusTarget] = useState<HTMLDivElement | null>(null);
  const [detail, setDetail] = useState<{ id: string; opener: HTMLElement }>();
  const [startingSet, setStartingSet] = useState<{
    opener: HTMLElement;
    id?: string;
  }>();
  const [repaying, setRepaying] = useState(false);
  const receipt =
    saleId && focusTarget ? { id: saleId, opener: focusTarget } : detail;
  const setSale =
    setTarget ??
    (startingSet?.id
      ? { id: startingSet.id, mode: "complete" as const }
      : undefined);
  const checkoutOpener = startingSet?.opener ?? focusTarget;
  const checkoutKey = setSale ? `${setSale.id}/${setSale.mode}` : productId;

  return (
    <>
      <div ref={setFocusTarget} tabIndex={-1}>
        <PageHeader
          title={t("title")}
          actions={
            <Button
              type="button"
              className="min-h-11 lg:min-h-9"
              onClick={(event) =>
                setStartingSet({ opener: event.currentTarget })
              }
            >
              {t("sellJewelrySet")}
            </Button>
          }
        />
      </div>
      <SaleList
        scope={scope}
        filters={filters}
        setFilters={setFilters}
        inspect={(id, opener) => setDetail({ id, opener })}
      />
      {startingSet && !startingSet.id && (
        <SaleSetPicker
          scope={scope}
          opener={startingSet.opener}
          close={() => setStartingSet(undefined)}
          select={(id) => setStartingSet({ ...startingSet, id })}
        />
      )}
      {checkoutKey && checkoutOpener && (
        <SaleCreate
          key={checkoutKey}
          scope={scope}
          productId={productId}
          setTarget={setSale}
          opener={checkoutOpener}
          close={startingSet ? () => setStartingSet(undefined) : closeCreate}
        />
      )}
      {!startingSet && !checkoutKey && receipt && (
        <ProductPanel
          title={t("detail")}
          close={saleId ? closeCreate : () => setDetail(undefined)}
          opener={receipt.opener}
          busy={repaying}
        >
          <SaleDetail
            scope={scope}
            id={receipt.id}
            onRepaymentSubmittingChange={setRepaying}
          />
        </ProductPanel>
      )}
    </>
  );
}
