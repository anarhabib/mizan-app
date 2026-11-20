import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ProductDetail as Detail } from "@mizan/contracts";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/features/workspace";
import { formatDateTime } from "@/shared/lib/format";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { MoneyText } from "@/shared/ui/MoneyText";
import { PurityText } from "@/shared/ui/PurityText";
import { WeightText } from "@/shared/ui/WeightText";
import {
  useDeleteProduct,
  useEditProductAcquisition,
  useUploadProductPhoto,
} from "../api/mutations";
import { productDetailQuery, type ProductScope } from "../api/queries";
import { ProductForm } from "./ProductCreate";
import { ProductStatusBadge } from "./ProductList";
import { ProductPanel } from "./ProductPanel";
import { ProductPhoto } from "./ProductPhoto";

export function ProductDetail({
  scope,
  id,
  opener,
  close,
  restoreFallbackFocus,
}: {
  scope: ProductScope;
  id: string;
  opener: HTMLElement;
  close: () => void;
  restoreFallbackFocus: () => void;
}) {
  const { t } = useTranslation(["products", "sales", "errors"]);
  const { role } = useWorkspace();
  const detail = useQuery(productDetailQuery(scope, id));
  const upload = useUploadProductPhoto(scope, id);
  const edit = useEditProductAcquisition(scope, id);
  const removal = useDeleteProduct(scope, id);
  const [view, setView] = useState<"detail" | "edit" | "delete">("detail");
  const product = detail.data;
  const owner = role === "OWNER";

  return (
    <ProductPanel
      title={
        view === "edit"
          ? t("editAcquisition")
          : view === "delete"
            ? t("delete.title")
            : (product?.name ?? t("detail"))
      }
      opener={opener}
      close={close}
      busy={upload.isPending || edit.isPending || removal.isPending}
      restoreFallbackFocus={restoreFallbackFocus}
      descriptionId={
        view === "delete" ? "product-delete-description" : undefined
      }
    >
      {owner && view === "edit" && product ? (
        <div className="grid gap-4">
          <ProductForm
            product={product}
            currency={product.acquisitionCost?.currency ?? ""}
            pending={edit.isPending}
            save={async (values) => {
              await edit.mutateAsync(values);
              setView("detail");
            }}
          />
          <Button
            variant="outline"
            onClick={() => setView("detail")}
            disabled={edit.isPending}
            className="min-h-11 lg:min-h-9"
          >
            {t("cancel")}
          </Button>
        </div>
      ) : owner && view === "delete" && product ? (
        <div className="grid gap-4">
          <p id="product-delete-description" className="text-muted-foreground">
            {t("delete.description", { name: product.name })}
          </p>
          {removal.error && (
            <p role="alert" className="text-destructive">
              {t(
                detail.error?.code === "PRODUCT_NOT_FOUND"
                  ? "PRODUCT_NOT_FOUND"
                  : removal.error.code === "PRODUCT_DELETE_CONFLICT"
                    ? "PRODUCT_DELETE_CONFLICT"
                    : removal.error.code === "ACCESS_DENIED"
                      ? "ACCESS_DENIED"
                      : "generic",
                { ns: "errors" },
              )}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              autoFocus
              variant="outline"
              onClick={() => setView("detail")}
              disabled={removal.isPending}
              className="min-h-11 lg:min-h-9"
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => removal.mutate(undefined, { onSuccess: close })}
              disabled={
                removal.isPending ||
                !product.canDelete ||
                detail.error?.code === "PRODUCT_NOT_FOUND"
              }
              className="min-h-11 lg:min-h-9"
            >
              {t(removal.isPending ? "delete.pending" : "delete.title")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {detail.isPending && <ListSkeleton rows={3} />}
          {detail.isError && (
            <ErrorState
              error={detail.error}
              pending={detail.isFetching}
              retry={() => void detail.refetch()}
            />
          )}
          {detail.data && (
            <div className="grid gap-6">
              {detail.data.status === "IN_STOCK" && (
                <Button
                  asChild
                  className="min-h-11 justify-self-start lg:min-h-9"
                >
                  <Link to="/sales" search={{ product: detail.data.id }}>
                    {t("sell", { ns: "sales" })}
                  </Link>
                </Button>
              )}
              <ProductPhoto
                product={detail.data}
                upload={upload}
                refresh={() => void detail.refetch()}
              />
              <ProductRecord product={detail.data} />
              {owner && detail.data.canEditAcquisition && (
                <Button
                  variant="outline"
                  onClick={() => setView("edit")}
                  disabled={upload.isPending}
                  className="min-h-11 justify-self-start lg:min-h-9"
                >
                  {t("editAcquisition")}
                </Button>
              )}
              {owner && detail.data.canDelete === false && (
                <p className="text-sm text-muted-foreground">
                  {t("delete.protected")}
                </p>
              )}
              {owner && detail.data.canDelete && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    removal.reset();
                    setView("delete");
                  }}
                  disabled={upload.isPending}
                  className="min-h-11 justify-self-start lg:min-h-9"
                >
                  {t("delete.title")}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </ProductPanel>
  );
}

function ProductRecord({ product }: { product: Detail }) {
  const { t, i18n } = useTranslation("products");
  const time = (value: string) => (
    <time dateTime={value}>{formatDateTime(value, i18n.resolvedLanguage)}</time>
  );
  const sale = product.status === "SOLD" ? product.sale : null;

  return (
    <>
      <dl className="grid grid-cols-2 gap-4">
        <Fact label={t("fields.code")}>{product.code}</Fact>
        <Fact label={t("fields.status")}>
          <ProductStatusBadge status={product.status} />
        </Fact>
        <Fact label={t("fields.category")}>{product.category}</Fact>
        <Fact label={t("fields.purity")}>
          <PurityText value={product.purity} />
        </Fact>
        <Fact label={t("fields.weight")}>
          <WeightText value={product.weight} />
        </Fact>
        {product.acquisitionCostPerGram && (
          <Fact label={t("fields.acquisitionCostPerGram")}>
            <MoneyText value={product.acquisitionCostPerGram} />
          </Fact>
        )}
        {product.acquisitionCost && (
          <Fact label={t("fields.acquisitionCost")}>
            <MoneyText value={product.acquisitionCost} />
          </Fact>
        )}
        <Fact label={t("fields.createdAt")}>{time(product.createdAt)}</Fact>
        {product.note && <Fact label={t("fields.note")}>{product.note}</Fact>}
      </dl>
      {sale && (
        <section className="grid gap-3 border-t pt-4">
          <h3 className="font-medium">{t("sale.title")}</h3>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label={t("sale.total")}>
              <MoneyText value={sale.total} />
            </Fact>
            <Fact label={t("sale.date")}>{time(sale.createdAt)}</Fact>
          </dl>
        </section>
      )}
      <section className="grid gap-3 border-t pt-4">
        <h3 className="font-medium">{t("movements.title")}</h3>
        {product.movements.length ? (
          <ol className="space-y-3 border-l pl-4">
            {product.movements.map((movement) => (
              <li
                key={movement.id}
                className="relative grid gap-2 before:absolute before:top-2 before:-left-5 before:size-2 before:rounded-full before:bg-muted-foreground"
              >
                <span>{t(`movements.${movement.kind}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {time(movement.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground">{t("movements.empty")}</p>
        )}
      </section>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 wrap-anywhere whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
