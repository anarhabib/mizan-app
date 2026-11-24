import { useState, type MouseEventHandler } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  categoryLabel,
  isSupplierCurrency,
  purchasePaymentStatuses,
  supplierPaymentMethods,
  type PurchaseSummary,
  type SupplierOption,
} from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { categoryQuery } from "@/features/product-categories";
import { productFacetsQuery, ProductStatusBadge } from "@/features/products";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { formatDateTime } from "@/shared/lib/format";
import { WeightText } from "@/shared/ui/WeightText";
import {
  paymentsQuery,
  purchasesQuery,
  supplierActivityQuery,
  supplierProductsQuery,
  type SupplierScope,
} from "../api/queries";
import {
  CalendarDate,
  controlClass,
  FilterSelect,
  LedgerRows,
  Listing,
  Payable,
  PurchaseStatus,
  TextFilter,
} from "./ledger";
import { SupplierPicker, useSupplierSearch } from "./SupplierPicker";

const linkClass =
  "inline-flex min-h-11 items-center font-medium underline underline-offset-2 lg:min-h-0";

export function PurchaseLink({
  purchase,
}: {
  purchase: Pick<
    PurchaseSummary,
    "id" | "supplier" | "purchaseDate" | "documentNumber"
  >;
}) {
  const { t } = useTranslation("suppliers");
  return (
    <Link
      to="/suppliers"
      search={{ supplier: purchase.supplier.id, purchase: purchase.id }}
      className={linkClass}
    >
      {purchase.documentNumber ?? (
        <>
          {t("purchase")} <span className="sr-only"> — </span>
          <span className="ml-1">
            <CalendarDate value={purchase.purchaseDate} />
          </span>
        </>
      )}
    </Link>
  );
}

function DateFilters({
  from,
  through,
  setFrom,
  setThrough,
}: {
  from: string;
  through: string;
  setFrom: (value: string) => void;
  setThrough: (value: string) => void;
}) {
  const { t } = useTranslation("suppliers");
  return (
    <>
      <TextFilter label={t("from")} type="date" value={from} set={setFrom} />
      <TextFilter
        label={t("through")}
        type="date"
        value={through}
        set={setThrough}
      />
    </>
  );
}

export function Purchases({
  scope,
  supplierId,
  create,
}: {
  scope: SupplierScope;
  supplierId?: string;
  create?: MouseEventHandler<HTMLButtonElement>;
}) {
  const { t } = useTranslation("suppliers");
  const [supplier, setSupplier] = useState<SupplierOption>();
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [status, setStatus] = useState<string>();
  const [currency, setCurrency] = useState("");
  const currencyQuery = useSupplierSearch(currency);
  const filters = {
    supplierId: supplierId ?? supplier?.id,
    from: from || undefined,
    through: through || undefined,
    status,
    currency: currencyQuery?.toUpperCase(),
  };
  const pagination = useCursorPagination(JSON.stringify(filters));
  const validRange = !from || !through || through >= from;
  const validCurrency =
    !currencyQuery || isSupplierCurrency(currencyQuery.toUpperCase());
  const query = useQuery({
    ...purchasesQuery(scope, filters, pagination.request),
    enabled: validRange && validCurrency,
  });
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {!supplierId && (
          <SupplierPicker
            scope={scope}
            value={supplier}
            onChange={setSupplier}
            onlyActive={false}
          />
        )}
        <DateFilters
          from={from}
          through={through}
          setFrom={setFrom}
          setThrough={setThrough}
        />
        <FilterSelect
          label={t("status")}
          value={status}
          set={setStatus}
          options={purchasePaymentStatuses.map((value) => ({
            value,
            label: t(`paymentStatus.${value}`),
          }))}
        />
        <TextFilter
          label={t("currency")}
          type="text"
          value={currency}
          set={setCurrency}
          maxLength={3}
        />
      </div>
      {validRange && validCurrency ? (
        <Listing
          query={query}
          pagination={pagination}
          label={t("purchases")}
          empty={t("noPurchases")}
          action={
            create && (
              <Button type="button" onClick={create} className={controlClass}>
                {t("registerPurchase")}
              </Button>
            )
          }
        >
          {(items) => (
            <LedgerRows
              columns={[
                t("documentNumber"),
                t("purchaseDate"),
                ...(!supplierId ? [t("supplier")] : []),
                t("products"),
                t("purchaseWeight"),
                t("purchased"),
                t("paid"),
                t("outstanding"),
                t("status"),
              ]}
              rows={items.map((purchase) => ({
                id: purchase.id,
                cells: [
                  <PurchaseLink purchase={purchase} />,
                  <CalendarDate value={purchase.purchaseDate} />,
                  ...(!supplierId ? [purchase.supplier.name] : []),
                  purchase.productCount,
                  <WeightText value={purchase.grossWeight} />,
                  <Payable value={purchase.total} />,
                  <Payable value={purchase.paid} />,
                  <Payable value={purchase.outstanding} />,
                  <PurchaseStatus value={purchase.status} />,
                ],
              }))}
            />
          )}
        </Listing>
      ) : (
        <p role="alert" className="text-destructive">
          {t(validRange ? "invalidCurrency" : "invalidDateRange")}
        </p>
      )}
    </div>
  );
}

export function SupplierProducts({
  scope,
  supplierId,
}: {
  scope: SupplierScope;
  supplierId: string;
}) {
  const { t, i18n } = useTranslation(["suppliers", "products"]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>();
  const [purity, setPurity] = useState<string>();
  const [status, setStatus] = useState<string>();
  const q = useSupplierSearch(search);
  const filters = { q, categoryId, purity, status };
  const pagination = useCursorPagination(JSON.stringify(filters));
  const query = useQuery(
    supplierProductsQuery(scope, supplierId, filters, pagination.request),
  );
  const categories = useQuery(categoryQuery(scope.organizationId, true));
  const facets = useQuery(productFacetsQuery(scope));
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TextFilter
          label={t("searchProducts")}
          value={search}
          set={setSearch}
        />
        <FilterSelect
          label={t("fields.category", { ns: "products" })}
          value={categoryId}
          set={setCategoryId}
          options={
            categories.data?.map((category) => ({
              value: category.id,
              label: categoryLabel(category, i18n.resolvedLanguage),
            })) ?? []
          }
        />
        <FilterSelect
          label={t("fields.purity", { ns: "products" })}
          value={purity}
          set={setPurity}
          options={
            facets.data?.purities.map((value) => ({
              value: String(value),
              label: String(value),
            })) ?? []
          }
        />
        <FilterSelect
          label={t("status")}
          value={status}
          set={setStatus}
          options={(["IN_STOCK", "SOLD"] as const).map((value) => ({
            value,
            label: t(`status.${value}`, { ns: "products" }),
          }))}
        />
      </div>
      <Listing
        query={query}
        pagination={pagination}
        label={t("products")}
        empty={t("noProducts")}
      >
        {(items) => (
          <LedgerRows
            columns={[
              t("product"),
              t("fields.category", { ns: "products" }),
              t("fields.purity", { ns: "products" }),
              t("fields.weight", { ns: "products" }),
              t("purchaseDate"),
              t("purchased"),
              t("status"),
            ]}
            rows={items.map((item) => ({
              id: item.id,
              cells: [
                <Link
                  to="/products"
                  search={{ product: item.id }}
                  className={linkClass}
                >
                  {item.code} · {item.name}
                </Link>,
                item.productCategory
                  ? categoryLabel(item.productCategory, i18n.resolvedLanguage)
                  : item.category,
                item.purity,
                <WeightText value={item.weight} />,
                <CalendarDate value={item.purchaseDate} />,
                <Payable value={item.acquisitionCost} />,
                <ProductStatusBadge status={item.status} />,
              ],
            }))}
          />
        )}
      </Listing>
    </div>
  );
}

function PaymentPurchaseFilter({
  scope,
  supplierId,
  value,
  set,
}: {
  scope: SupplierScope;
  supplierId: string;
  value?: PurchaseSummary;
  set: (value?: PurchaseSummary) => void;
}) {
  const { t } = useTranslation("suppliers");
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2 lg:col-span-2">
      <span>{t("relatedPurchase")}</span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className={controlClass}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {value?.documentNumber ??
            (value ? (
              <CalendarDate value={value.purchaseDate} />
            ) : (
              t("filterPurchase")
            ))}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            className={controlClass}
            onClick={() => set(undefined)}
          >
            {t("clearPurchase")}
          </Button>
        )}
      </div>
      {open && (
        <PaymentPurchaseOptions
          scope={scope}
          supplierId={supplierId}
          select={(purchase) => {
            set(purchase);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PaymentPurchaseOptions({
  scope,
  supplierId,
  select,
}: {
  scope: SupplierScope;
  supplierId: string;
  select: (purchase: PurchaseSummary) => void;
}) {
  const { t } = useTranslation("suppliers");
  const pagination = useCursorPagination(supplierId);
  const query = useQuery(
    purchasesQuery(scope, { supplierId }, pagination.request),
  );
  return (
    <div className="rounded-lg border bg-card p-3">
      <Listing
        query={query}
        pagination={pagination}
        label={t("purchases")}
        empty={t("noPurchases")}
      >
        {(items) => (
          <ul className="max-h-48 divide-y overflow-y-auto">
            {items.map((purchase) => (
              <li key={purchase.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-auto w-full justify-start whitespace-normal text-left ${controlClass}`}
                  onClick={() => select(purchase)}
                >
                  <span className="min-w-0 wrap-anywhere">
                    {purchase.documentNumber ?? t("purchase")} ·{" "}
                    <CalendarDate value={purchase.purchaseDate} /> ·{" "}
                    <Payable value={purchase.total} />
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Listing>
    </div>
  );
}

export function Payments({
  scope,
  supplierId,
  purchaseId,
}: {
  scope: SupplierScope;
  supplierId: string;
  purchaseId?: string;
}) {
  const { t } = useTranslation(["suppliers", "sales", "auth"]);
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [method, setMethod] = useState<string>();
  const [purchase, setPurchase] = useState<PurchaseSummary>();
  const filters = {
    from: from || undefined,
    through: through || undefined,
    method,
    purchaseId: purchaseId ?? purchase?.id,
  };
  const pagination = useCursorPagination(JSON.stringify(filters));
  const validRange = !from || !through || through >= from;
  const query = useQuery({
    ...paymentsQuery(scope, supplierId, filters, pagination.request),
    enabled: validRange,
  });
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <DateFilters
          from={from}
          through={through}
          setFrom={setFrom}
          setThrough={setThrough}
        />
        <FilterSelect
          label={t("method")}
          value={method}
          set={setMethod}
          options={supplierPaymentMethods.map((value) => ({
            value,
            label: t(`methods.${value}`, { ns: "sales" }),
          }))}
        />
        {!purchaseId && (
          <PaymentPurchaseFilter
            scope={scope}
            supplierId={supplierId}
            value={purchase}
            set={setPurchase}
          />
        )}
      </div>
      {validRange ? (
        <Listing
          query={query}
          pagination={pagination}
          label={t("payments")}
          empty={t("noPayments")}
        >
          {(items) => (
            <LedgerRows
              columns={[
                t("paymentDate"),
                t("amount"),
                t("method"),
                ...(!purchaseId ? [t("relatedPurchase")] : []),
                t("referenceNumber"),
                t("actor"),
                t("fields.note"),
              ]}
              rows={items.map((payment) => ({
                id: payment.id,
                cells: [
                  <CalendarDate value={payment.paymentDate} />,
                  <Payable value={payment} />,
                  <span>
                    {t(`methods.${payment.method}`, { ns: "sales" })}
                    {payment.isInitial && (
                      <span className="block text-xs text-muted-foreground">
                        {t("initialPayment")}
                      </span>
                    )}
                  </span>,
                  ...(!purchaseId
                    ? [
                        <PurchaseLink
                          purchase={{
                            id: payment.purchaseId,
                            supplier: { id: supplierId, name: "" },
                            purchaseDate: payment.purchaseDate,
                            documentNumber: payment.documentNumber,
                          }}
                        />,
                      ]
                    : []),
                  payment.referenceNumber,
                  payment.actorName ?? t("unknownActor", { ns: "auth" }),
                  payment.note,
                ],
              }))}
            />
          )}
        </Listing>
      ) : (
        <p role="alert" className="text-destructive">
          {t("invalidDateRange")}
        </p>
      )}
    </div>
  );
}

export function Activity({
  scope,
  supplierId,
}: {
  scope: SupplierScope;
  supplierId: string;
}) {
  const { t, i18n } = useTranslation(["suppliers", "auth"]);
  const pagination = useCursorPagination(supplierId);
  const query = useQuery(
    supplierActivityQuery(scope, supplierId, pagination.request),
  );
  return (
    <Listing
      query={query}
      pagination={pagination}
      label={t("activity")}
      empty={t("noActivity")}
    >
      {(items) => (
        <LedgerRows
          columns={[
            t("event"),
            t("recordedAt"),
            t("actor"),
            t("relatedRecord"),
          ]}
          rows={items.map((activity) => ({
            id: activity.id,
            cells: [
              <>
                <span className="font-medium">
                  {t(`events.${activity.kind}`)}
                </span>
                {activity.productCount && (
                  <span className="ml-2 text-muted-foreground">
                    ({activity.productCount})
                  </span>
                )}
              </>,
              <time dateTime={activity.createdAt}>
                {formatDateTime(activity.createdAt, i18n.resolvedLanguage)}
              </time>,
              activity.actorName ?? t("unknownActor", { ns: "auth" }),
              activity.purchaseId ? (
                <Link
                  to="/suppliers"
                  className={linkClass}
                  search={{
                    supplier: supplierId,
                    purchase: activity.purchaseId,
                  }}
                >
                  {t("openPurchase")}
                </Link>
              ) : activity.productId ? (
                <Link
                  to="/products"
                  className={linkClass}
                  search={{ product: activity.productId }}
                >
                  {t("openProduct")}
                </Link>
              ) : null,
            ],
          }))}
        />
      )}
    </Listing>
  );
}
