import { useQuery } from "@tanstack/react-query";
import type {
  JewelrySetDetail,
  JewelrySetProduct,
  SaleJewelrySetSelection,
} from "@mizan/contracts";
import { RotateCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  jewelrySetDetailQuery,
  ProductPanel,
  productDetailQuery,
} from "@/features/products";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { PurityText } from "@/shared/ui/PurityText";
import { WeightText } from "@/shared/ui/WeightText";
import { saleOptionsQuery, type SaleScope } from "../api/queries";
import { useSaleSubmission } from "../hooks/useSaleSubmission";
import { SaleForm } from "./SaleForm";
import { SaleDetail } from "./SaleResult";

export type SetSaleTarget = Pick<SaleJewelrySetSelection, "id" | "mode">;
type SetCheckout = {
  name: string;
  selection: SaleJewelrySetSelection;
  products: JewelrySetProduct[];
};

function SelectSetComponents({
  set,
  available,
  select,
}: {
  set: JewelrySetDetail;
  available: JewelrySetProduct[];
  select: (products: JewelrySetProduct[]) => void;
}) {
  const { t, i18n } = useTranslation("sales");
  const searchId = useId();
  const [ids, setIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const products = available.filter(({ id }) => ids.includes(id));
  const language = i18n.resolvedLanguage;
  const q = search.trim().toLocaleLowerCase(language);
  const matches = available.filter(({ code, name }) =>
    `${code} ${name}`.toLocaleLowerCase(language).includes(q),
  );
  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="font-medium wrap-anywhere">{set.name}</legend>
      <p className="text-muted-foreground">{t("selectSetComponents")}</p>
      <div className="grid gap-2">
        <Label htmlFor={searchId}>{t("searchProducts")}</Label>
        <Input
          id={searchId}
          type="search"
          className="min-h-11 lg:min-h-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {matches.length ? (
        <ul className="divide-y rounded-lg border bg-card">
          {matches.map((product) => (
            <li key={product.id}>
              <label
                className="flex min-h-11 cursor-pointer items-center gap-3 p-3"
                htmlFor={`select-component-${product.id}`}
              >
                <Checkbox
                  id={`select-component-${product.id}`}
                  checked={ids.includes(product.id)}
                  onCheckedChange={(checked) =>
                    setIds((previous) =>
                      checked === true
                        ? [...previous, product.id]
                        : previous.filter((id) => id !== product.id),
                    )
                  }
                />
                <span className="min-w-0 wrap-anywhere">
                  <span className="block font-medium">
                    {product.code} · {product.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    <WeightText value={product.weight} /> ·{" "}
                    <PurityText value={product.purity} />
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="text-muted-foreground">
          {t("noProducts")}
        </p>
      )}
      <Button
        type="button"
        className="min-h-11 justify-self-start whitespace-normal lg:min-h-9"
        disabled={!products.length}
        onClick={() => select(products)}
      >
        {t("continueWithComponents", { count: products.length })}
      </Button>
    </fieldset>
  );
}

export function SaleCreate({
  scope,
  productId,
  setTarget,
  opener,
  close,
}: {
  scope: SaleScope;
  productId?: string;
  setTarget?: SetSaleTarget;
  opener: HTMLElement;
  close: () => void;
}) {
  const { t } = useTranslation("sales");
  const { t: customerText } = useTranslation("customers");
  const product = useQuery({
    ...productDetailQuery(scope, productId ?? ""),
    enabled: !!productId && !setTarget,
    refetchOnMount: "always",
  });
  const setQuery = useQuery({
    ...jewelrySetDetailQuery(scope, setTarget?.id),
    refetchOnMount: "always",
  });
  const set = setQuery.data;
  const [setCheckout, setSetCheckout] = useState<SetCheckout>();
  const available =
    set?.products.filter(({ status }) => status === "IN_STOCK") ?? [];
  const setReady =
    set && setTarget && !setQuery.isError && setQuery.isFetchedAfterMount;
  const canSellSet =
    setReady &&
    available.length > 0 &&
    (setTarget.mode === "selected" || available.length === set.products.length);

  function startSetCheckout(products: JewelrySetProduct[]) {
    if (!set || !setTarget || !products.length) return;
    // Retain the reviewed revision when the set query refreshes.
    setSetCheckout({
      name: set.name,
      selection: { ...setTarget, revision: set.revision },
      products,
    });
  }
  if (!setCheckout && canSellSet && setTarget.mode === "complete")
    startSetCheckout(available);

  const submission = useSaleSubmission(
    scope,
    setTarget ? undefined : productId,
  );
  const isInStock = product.data?.status === "IN_STOCK";
  const checkoutProductId =
    setCheckout?.products[0]?.id ?? (isInStock ? productId : undefined);
  const options = useQuery({
    ...saleOptionsQuery(scope),
    enabled: !!checkoutProductId,
  });
  const saleId =
    submission.resultId ?? submission.recoveredId ?? product.data?.sale?.id;
  const [submittingForm, setSubmittingForm] = useState(false);
  const [repaying, setRepaying] = useState(false);
  const receipt = useRef<HTMLDivElement>(null);
  const setHeading = useRef<HTMLHeadingElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!setCheckout) return;
    setHeading.current?.scrollIntoView({ block: "start" });
    setHeading.current?.focus({ preventScroll: true });
  }, [setCheckout]);
  useEffect(() => {
    if (setCheckout && submission.needsCheck && !submission.busy)
      retryButton.current?.focus();
  }, [setCheckout, submission.busy, submission.needsCheck]);
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
      busy={submission.busy || submittingForm || repaying}
    >
      {saleId ? (
        <div ref={receipt} tabIndex={-1}>
          {!submission.resultId && (
            <p role="status" className="mb-4 text-muted-foreground">
              {t("alreadyRecorded")}
            </p>
          )}
          <SaleDetail
            scope={scope}
            id={saleId}
            onRepaymentSubmittingChange={setRepaying}
          />
        </div>
      ) : (
        <div className="grid gap-4">
          {!setTarget && product.isPending && <ListSkeleton rows={3} />}
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
          {setTarget && !setCheckout && (
            <>
              {(setQuery.isPending || (setQuery.isFetching && !setReady)) && (
                <ListSkeleton rows={3} />
              )}
              {setQuery.isError && (
                <ErrorState
                  error={setQuery.error}
                  pending={setQuery.isFetching}
                  retry={() => void setQuery.refetch()}
                />
              )}
              {setReady && !canSellSet && (
                <p role="alert" className="text-destructive">
                  {t("errors.setUnavailable")}
                </p>
              )}
              {set && canSellSet && setTarget.mode === "selected" && (
                <SelectSetComponents
                  key={set.revision}
                  set={set}
                  available={available}
                  select={startSetCheckout}
                />
              )}
            </>
          )}
          {setCheckout && (
            <div className="grid gap-1 border-b pb-3">
              <h3
                ref={setHeading}
                tabIndex={-1}
                className="font-medium wrap-anywhere"
              >
                {setCheckout.name}
              </h3>
              <p className="text-muted-foreground">
                {t(
                  setCheckout.selection.mode === "complete"
                    ? "completeSetCount"
                    : "selectedSetCount",
                  {
                    count: setCheckout.products.length,
                  },
                )}
              </p>
            </div>
          )}
          {submission.needsCheck && (
            <section className="grid gap-3 rounded-lg border border-border bg-muted p-3">
              <p role="status">
                {t(
                  submission.busy
                    ? "checking"
                    : setCheckout
                      ? "setRetryRequired"
                      : "checkRequired",
                )}
              </p>
              {!submission.busy && (
                <Button
                  ref={retryButton}
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-self-start lg:min-h-9"
                  onClick={() => void submission.checkAgain()}
                >
                  <RotateCw aria-hidden="true" />
                  {t(setCheckout ? "retrySetSale" : "checkAgain")}
                </Button>
              )}
            </section>
          )}
          {submission.retryError && (
            <p role="alert" className="text-destructive">
              {submission.retryError === "customerRequired"
                ? customerText("requiredForDebt")
                : submission.retryError === "customerMissing"
                  ? customerText("missing")
                  : t(`errors.${submission.retryError}`)}
            </p>
          )}
          {product.data && !isInStock && !submission.needsCheck && (
            <p role="alert">{t("unavailable")}</p>
          )}
          {checkoutProductId && (
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
                  productId={checkoutProductId}
                  setCheckout={setCheckout}
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
                  onSubmittingChange={setSubmittingForm}
                />
              )}
            </>
          )}
        </div>
      )}
    </ProductPanel>
  );
}
