import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ProductPanel, productDetailQuery } from "@/features/products";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { saleOptionsQuery, type SaleScope } from "../api/queries";
import { useSaleSubmission } from "../hooks/useSaleSubmission";
import { SaleForm } from "./SaleForm";
import { SaleDetail } from "./SaleResult";

export function SaleCreate({
  scope,
  productId,
  opener,
  close,
}: {
  scope: SaleScope;
  productId: string;
  opener: HTMLElement;
  close: () => void;
}) {
  const { t } = useTranslation("sales");
  const product = useQuery({
    ...productDetailQuery(scope, productId),
    refetchOnMount: "always",
  });
  const submission = useSaleSubmission(scope, productId);
  const isInStock = product.data?.status === "IN_STOCK";
  const options = useQuery({ ...saleOptionsQuery(scope), enabled: isInStock });
  const saleId =
    submission.resultId ?? submission.recoveredId ?? product.data?.sale?.id;
  const receipt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!saleId) return;
    receipt.current?.scrollIntoView({ block: "start" });
    receipt.current?.focus({ preventScroll: true });
  }, [saleId]);
  return (
    <ProductPanel
      title={t(
        submission.resultId
          ? "recorded"
          : saleId
            ? "detail"
            : submission.confirmation
              ? "confirmTitle"
              : "sell",
      )}
      descriptionId={
        submission.confirmation ? "sale-confirmation-description" : undefined
      }
      opener={opener}
      close={submission.confirmation ? submission.cancelConfirmation : close}
      busy={submission.busy}
    >
      {saleId ? (
        <div ref={receipt} tabIndex={-1}>
          {!submission.resultId && (
            <p role="status" className="mb-4 text-muted-foreground">
              {t("alreadyRecorded")}
            </p>
          )}
          <SaleDetail scope={scope} id={saleId} />
        </div>
      ) : (
        <div className="grid gap-4">
          {product.isPending && <ListSkeleton rows={3} />}
          {!submission.needsCheck && product.isError && (
            <ErrorState
              error={product.error}
              pending={product.isFetching}
              retry={() => void product.refetch()}
            />
          )}
          {product.data && !submission.confirmation && (
            <div className="grid gap-2 border-b pb-4">
              <h3 className="font-medium wrap-anywhere">{product.data.name}</h3>
              <p className="wrap-anywhere text-muted-foreground">
                {product.data.code}
              </p>
            </div>
          )}
          {submission.needsCheck && (
            <section className="grid gap-3 rounded-lg border p-3">
              <p role="status">
                {t(submission.busy ? "checking" : "checkRequired")}
              </p>
              {!submission.busy && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-self-start lg:min-h-9"
                  onClick={() => void submission.checkAgain()}
                >
                  {t("checkAgain")}
                </Button>
              )}
            </section>
          )}
          {product.data && !isInStock && !submission.needsCheck && (
            <p role="alert">{t("unavailable")}</p>
          )}
          {isInStock && (
            <>
              {options.isPending && <ListSkeleton rows={3} />}
              {options.isError && (
                <ErrorState
                  error={options.error}
                  pending={options.isFetching}
                  retry={() => void options.refetch()}
                />
              )}
              {options.data && (
                <SaleForm
                  scope={scope}
                  productId={productId}
                  options={options.data}
                  disabled={
                    submission.busy ||
                    submission.needsCheck ||
                    product.isFetching ||
                    product.isError ||
                    options.isError ||
                    options.isFetching
                  }
                  submission={submission}
                />
              )}
            </>
          )}
        </div>
      )}
    </ProductPanel>
  );
}
