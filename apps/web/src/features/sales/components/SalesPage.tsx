import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProductPanel } from "@/features/products";
import { useWorkspace } from "@/features/workspace";
import { PageHeader } from "@/shared/ui/PageHeader";
import type { SaleFilters, SaleScope } from "../api/queries";
import { SaleCreate } from "./SaleCreate";
import { SaleList } from "./SaleList";
import { SaleDetail } from "./SaleResult";

type CreateTarget = {
  productId?: string;
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
  saleId,
  closeCreate,
  filters,
  setFilters,
}: CreateTarget & { scope: SaleScope }) {
  const { t } = useTranslation("sales");
  const [focusTarget, setFocusTarget] = useState<HTMLDivElement | null>(null);
  const [detail, setDetail] = useState<{ id: string; opener: HTMLElement }>();
  const [repaying, setRepaying] = useState(false);
  const receipt =
    saleId && focusTarget ? { id: saleId, opener: focusTarget } : detail;

  return (
    <>
      <div ref={setFocusTarget} tabIndex={-1}>
        <PageHeader title={t("title")} />
      </div>
      <SaleList
        scope={scope}
        filters={filters}
        setFilters={setFilters}
        inspect={(id, opener) => setDetail({ id, opener })}
      />
      {productId && focusTarget && (
        <SaleCreate
          key={productId}
          scope={scope}
          productId={productId}
          opener={focusTarget}
          close={closeCreate}
        />
      )}
      {!productId && receipt && (
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
