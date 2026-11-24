import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConfirmationContent } from "@/shared/ui/ConfirmationContent";
import { PendingButton } from "@/shared/ui/PendingButton";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  acquisitionComponents,
  type ProductDetail as Detail,
  type SupplierOption,
} from "@mizan/contracts";
import { ShoppingCart } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/features/workspace";
import { CalendarDate, SupplierPicker } from "@/features/suppliers";
import { formatDateTime, formatDecimal } from "@/shared/lib/format";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { MoneyText } from "@/shared/ui/MoneyText";
import { PurityText } from "@/shared/ui/PurityText";
import { WeightText } from "@/shared/ui/WeightText";
import {
  useDeleteProduct,
  useEditProductAcquisition,
  useLinkHistoricalSupplier,
  useUploadProductPhoto,
} from "../api/mutations";
import { productDetailQuery, type ProductScope } from "../api/queries";
import { ProductForm } from "./ProductForm";
import { categoryLabel } from "@mizan/contracts";
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
  const { canManageAsOwner: owner, canViewAcquisition } = useWorkspace();
  const detail = useQuery(productDetailQuery(scope, id));
  const upload = useUploadProductPhoto(scope, id);
  const edit = useEditProductAcquisition(scope, id);
  const removal = useDeleteProduct(scope, id);
  const linkSupplier = useLinkHistoricalSupplier(scope, id);
  const [linkingSupplier, setLinkingSupplier] = useState(false);
  const [supplier, setSupplier] = useState<SupplierOption>();
  const [view, setView] = useState<"detail" | "edit">("detail");
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const product = detail.data;

  return (
    <ProductPanel
      title={
        view === "edit" ? t("editAcquisition") : (product?.name ?? t("detail"))
      }
      opener={opener}
      close={close}
      busy={
        upload.isPending ||
        submittingEdit ||
        edit.isPending ||
        removal.isPending ||
        linkSupplier.isPending
      }
      restoreFallbackFocus={restoreFallbackFocus}
    >
      {owner && view === "edit" && product ? (
        <div className="grid gap-4">
          <ProductForm
            scope={scope}
            product={product}
            currency={product.acquisitionCost?.currency ?? ""}
            pending={edit.isPending}
            onSubmittingChange={setSubmittingEdit}
            save={async (values) => {
              await edit.mutateAsync(values);
              toast.success(t("updated"));
              setView("detail");
            }}
          />
          <Button
            variant="secondary"
            onClick={() => setView("detail")}
            disabled={submittingEdit || edit.isPending}
            className="min-h-11 lg:min-h-9"
          >
            {t("cancel")}
          </Button>
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
                    <ShoppingCart aria-hidden="true" />
                    {t("sell", { ns: "sales" })}
                  </Link>
                </Button>
              )}
              <ProductPhoto
                product={detail.data}
                upload={upload}
                refresh={() => void detail.refetch()}
              />
              <ProductRecord
                product={detail.data}
                canViewAcquisition={canViewAcquisition}
              />
              {owner &&
                !detail.data.purchase &&
                !detail.data.historicalSupplier &&
                (linkingSupplier ? (
                  <section className="grid gap-3 border-t pt-3">
                    <SupplierPicker
                      label={t("registration.historicalSupplier")}
                      scope={scope}
                      value={supplier}
                      onChange={setSupplier}
                      onlyActive={false}
                      disabled={linkSupplier.isPending}
                    />
                    <p className="text-muted-foreground">
                      {t("registration.historicalHint")}
                    </p>
                    {linkSupplier.error && (
                      <p role="alert" className="text-destructive">
                        {t(linkSupplier.error.code, {
                          ns: "errors",
                          defaultValue: t("generic", { ns: "errors" }),
                        })}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <PendingButton
                        pending={linkSupplier.isPending}
                        disabled={!supplier}
                        onClick={() => {
                          if (!supplier) return;
                          linkSupplier.mutate(supplier.id, {
                            onSuccess: () => {
                              toast.success(t("registration.supplierLinked"));
                              setLinkingSupplier(false);
                            },
                          });
                        }}
                      >
                        {t("save")}
                      </PendingButton>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={linkSupplier.isPending}
                        onClick={() => {
                          linkSupplier.reset();
                          setLinkingSupplier(false);
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </section>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 justify-self-start lg:min-h-9"
                    onClick={() => setLinkingSupplier(true)}
                  >
                    {t("registration.linkHistoricalSupplier")}
                  </Button>
                ))}
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
              {owner && (detail.data.canDelete || confirmDelete) && (
                <AlertDialog
                  open={confirmDelete}
                  onOpenChange={(next) => {
                    if (!removal.isPending) {
                      if (next) removal.reset();
                      setConfirmDelete(next);
                    }
                  }}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={upload.isPending || !detail.data.canDelete}
                      className="min-h-11 justify-self-start lg:min-h-9"
                    >
                      {t("delete.title")}
                    </Button>
                  </AlertDialogTrigger>
                  <ConfirmationContent
                    onEscapeKeyDown={(event) => {
                      if (removal.isPending) event.preventDefault();
                    }}
                  >
                    <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("delete.description", { name: detail.data.name })}
                    </AlertDialogDescription>
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
                      <AlertDialogCancel asChild>
                        <Button
                          variant="secondary"

                          disabled={removal.isPending}
                          className="min-h-11 lg:min-h-9"
                        >
                          {t("cancel")}
                        </Button>
                      </AlertDialogCancel>
                      <PendingButton
                        pending={removal.isPending}
                        variant="destructive"
                        onClick={() =>
                          removal.mutate(undefined, {
                            onSuccess: () => {
                              toast.success(t("deleted"));
                              close();
                            },
                          })
                        }
                        disabled={
                          removal.isPending ||
                          !detail.data.canDelete ||
                          detail.error?.code === "PRODUCT_NOT_FOUND"
                        }
                        className="min-h-11 lg:min-h-9"
                      >
                        {t(
                          removal.isPending ? "delete.pending" : "delete.title",
                        )}
                      </PendingButton>
                    </div>
                  </ConfirmationContent>
                </AlertDialog>
              )}
            </div>
          )}
        </>
      )}
    </ProductPanel>
  );
}

function ProductRecord({
  product,
  canViewAcquisition,
}: {
  product: Detail;
  canViewAcquisition: boolean;
}) {
  const { t, i18n } = useTranslation(["products", "auth", "suppliers"]);
  const locale = i18n.resolvedLanguage ?? "az";
  const acquisitionCurrency = product.acquisitionCost?.currency;
  const time = (value: string) => (
    <time dateTime={value}>{formatDateTime(value, i18n.resolvedLanguage)}</time>
  );
  const sale = product.status === "SOLD" ? product.sale : null;

  return (
    <>
      <dl className="grid grid-cols-2 gap-4">
        <Fact label={t("fields.code")}>{product.code}</Fact>
        <Fact label={t("fields.status")}>
          <ProductStatusBadge
            status={product.status}
            hasOutstandingDebt={product.hasOutstandingDebt}
          />
        </Fact>
        <Fact label={t("fields.category")}>
          {product.productCategory
            ? categoryLabel(product.productCategory, locale)
            : product.category}
        </Fact>
        {product.registrationSource && (
          <Fact label={t("registration.source")}>
            {t(`registration.sources.${product.registrationSource}`)}
          </Fact>
        )}
        {product.historicalSupplier && (
          <Fact label={t("registration.historicalSupplier")}>
            <Link
              to="/suppliers"
              search={{ supplier: product.historicalSupplier.id }}
              className="inline-flex min-h-11 items-center underline underline-offset-2 lg:min-h-0"
            >
              {product.historicalSupplier.name}
            </Link>
          </Fact>
        )}
        {product.purchase && (
          <>
            <Fact label={t("supplier", { ns: "suppliers" })}>
              <Link
                to="/suppliers"
                search={{ supplier: product.purchase.supplierId }}
                className="inline-flex min-h-11 items-center underline underline-offset-2 lg:min-h-0"
              >
                {product.purchase.supplierName}
              </Link>
            </Fact>
            <Fact label={t("purchase", { ns: "suppliers" })}>
              <Link
                to="/suppliers"
                search={{
                  supplier: product.purchase.supplierId,
                  purchase: product.purchase.id,
                }}
                className="inline-flex min-h-11 items-center underline underline-offset-2 lg:min-h-0"
              >
                {product.purchase.documentNumber ??
                  t("openPurchase", { ns: "suppliers" })}
              </Link>
            </Fact>
            {product.purchase.purchaseDate && (
              <Fact label={t("purchaseDate", { ns: "suppliers" })}>
                <CalendarDate value={product.purchase.purchaseDate} />
              </Fact>
            )}
          </>
        )}
        <Fact label={t("fields.metalType")}>{t("jewelry.gold")}</Fact>
        <Fact label={t("fields.purity")}>
          <PurityText value={product.purity} />
        </Fact>
        <Fact label={t("fields.weight")}>
          <WeightText value={product.weight} />
        </Fact>
        {product.netGoldWeight && (
          <Fact label={t("fields.netGoldWeight")}>
            <WeightText value={product.netGoldWeight} />
          </Fact>
        )}
        {product.fixedSellingPrice && (
          <Fact label={t("fields.fixedSellingPrice")}>
            <MoneyText value={product.fixedSellingPrice} />
          </Fact>
        )}

        {product.estimatedMetalSellingValue && (
          <Fact label={t("fields.estimatedMetalSellingValue")}>
            <MoneyText value={product.estimatedMetalSellingValue} />
          </Fact>
        )}
        {canViewAcquisition && product.acquisitionCostPerGram && (
          <Fact label={t("fields.acquisitionCostPerGram")}>
            <MoneyText value={product.acquisitionCostPerGram} />
          </Fact>
        )}
        {canViewAcquisition && product.acquisitionCost && (
          <Fact label={t("fields.acquisitionCost")}>
            <MoneyText value={product.acquisitionCost} />
          </Fact>
        )}
        {product.estimatedSellingValue && (
          <Fact
            label={t(
              product.netGoldWeight !== product.weight
                ? "fields.estimatedMetalSellingValue"
                : "fields.estimatedSellingValue",
            )}
          >
            <MoneyText value={product.estimatedSellingValue} />
          </Fact>
        )}
        <Fact label={t("fields.createdAt")}>{time(product.createdAt)}</Fact>
        {product.note && <Fact label={t("fields.note")}>{product.note}</Fact>}
      </dl>
      {Boolean(product.gemstones?.length) && (
        <section className="grid gap-3">
          <h3 className="font-medium">{t("jewelry.gemstones")}</h3>
          {product.gemstones?.map((group, index) => (
            <div key={index} className="grid gap-3 rounded-md border p-3">
              <h4 className="font-medium wrap-anywhere">
                {group.gemstoneType}
              </h4>
              <dl className="grid grid-cols-2 gap-3">
                <Fact label={t("jewelry.stoneFields.stoneCount")}>
                  {group.stoneCount}
                </Fact>
                <Fact label={t("jewelry.stoneFields.origin")}>
                  {t(`jewelry.origins.${group.origin ?? "UNKNOWN"}`)}
                </Fact>
                {(["totalCarats", "individualCarats"] as const).map((field) => {
                  const amount = group[field];
                  return (
                    amount && (
                      <Fact
                        key={field}
                        label={t(`jewelry.stoneFields.${field}`)}
                      >
                        <span className="tabular-nums">
                          {t("jewelry.carats", {
                            amount: formatDecimal(amount, locale),
                          })}
                        </span>
                      </Fact>
                    )
                  );
                })}
                {(
                  [
                    "shape",
                    "color",
                    "clarity",
                    "cutGrade",
                    "treatment",
                    "laboratory",
                    "reportNumber",
                    "note",
                  ] as const
                ).map(
                  (field) =>
                    group[field] && (
                      <Fact
                        key={field}
                        label={t(`jewelry.stoneFields.${field}`)}
                      >
                        {group[field]}
                      </Fact>
                    ),
                )}
              </dl>
            </div>
          ))}
        </section>
      )}
      {canViewAcquisition &&
        acquisitionCurrency &&
        product.acquisitionBreakdown && (
          <section className="grid gap-3 rounded-md border p-3">
            <h3 className="font-medium">{t("jewelry.componentsTitle")}</h3>
            <dl className="grid grid-cols-2 gap-3">
              {acquisitionComponents.map((part) => {
                const amount = product.acquisitionBreakdown?.[part];
                return (
                  amount !== undefined && (
                    <Fact key={part} label={t(`jewelry.components.${part}`)}>
                      <MoneyText
                        value={{
                          amount,
                          currency: acquisitionCurrency,
                        }}
                      />
                    </Fact>
                  )
                );
              })}
            </dl>
          </section>
        )}
      {sale && (
        <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
          <h3 className="font-medium">{t("sale.title")}</h3>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label={t("sale.total")}>
              <MoneyText value={sale.total} />
            </Fact>
            <Fact label={t("sale.date")}>{time(sale.createdAt)}</Fact>
          </dl>
        </section>
      )}
      <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
        <h3 className="font-medium">{t("movements.title")}</h3>
        {product.movements.length ? (
          <ol className="space-y-3 border-l pl-4">
            {product.movements.map((movement) => (
              <li
                key={movement.id}
                className="relative grid gap-2 before:absolute before:top-2 before:-left-5 before:size-2 before:rounded-full before:bg-muted-foreground"
              >
                <span>
                  {movement.registrationSource
                    ? t(`registration.sources.${movement.registrationSource}`)
                    : t(`movements.${movement.kind}`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {time(movement.createdAt)}
                  {" · "}
                  {movement.actorName ?? t("unknownActor", { ns: "auth" })}
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
