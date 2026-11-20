import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProductPanel } from "@/features/products";
import { useWorkspace } from "@/features/workspace";
import { PageHeader } from "@/shared/ui/PageHeader";
import type { SaleScope } from "../api/queries";
import { SaleCreate } from "./SaleCreate";
import { SaleList } from "./SaleList";
import { SaleDetail } from "./SaleResult";

type CreateTarget = { productId?: string; closeCreate: () => void };

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
  closeCreate,
}: CreateTarget & { scope: SaleScope }) {
  const { t } = useTranslation("sales");
  const [focusTarget, setFocusTarget] = useState<HTMLDivElement | null>(null);
  const [detail, setDetail] = useState<{ id: string; opener: HTMLElement }>();

  return (
    <>
      <div ref={setFocusTarget} tabIndex={-1}>
        <PageHeader title={t("title")} />
      </div>
      <SaleList
        scope={scope}
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
      {!productId && detail && (
        <ProductPanel
          title={t("detail")}
          close={() => setDetail(undefined)}
          opener={detail.opener}
        >
          <SaleDetail scope={scope} id={detail.id} />
        </ProductPanel>
      )}
    </>
  );
}
