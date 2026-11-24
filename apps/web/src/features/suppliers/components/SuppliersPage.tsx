import { useState, type MouseEventHandler } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  acquisitionComponents,
  categoryLabel,
  type Supplier,
  type SupplierOverview,
} from "@mizan/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { PageHeader } from "@/shared/ui/PageHeader";
import { PendingButton } from "@/shared/ui/PendingButton";
import { WeightText } from "@/shared/ui/WeightText";
import { formatDateTime, formatDecimal } from "@/shared/lib/format";
import {
  purchaseQuery,
  supplierQuery,
  suppliersQuery,
  useSaveSupplier,
  type SupplierScope,
} from "../api/queries";
import { Activity, Payments, Purchases, SupplierProducts } from "./Histories";
import {
  CalendarDate,
  controlClass,
  Fact,
  FilterSelect,
  LedgerRows,
  Listing,
  Payable,
  PurchaseStatus,
  TextFilter,
  WriteError,
} from "./ledger";
import { PaymentForm } from "./PaymentForm";
import { PurchaseForm } from "./PurchaseForm";
import { SupplierForm } from "./SupplierForm";
import { useSupplierSearch } from "./SupplierPicker";

type FormPanel = { kind: "supplier" | "purchase"; opener: HTMLButtonElement };

export type SuppliersSearch = {
  supplier?: string;
  purchase?: string;
  view?: "purchases";
};

export function SuppliersPage({ search }: { search: SuppliersSearch }) {
  const { organizationId, storeId, settings, canManageAsOwner } =
    useWorkspace();
  const { t } = useTranslation(["suppliers", "errors"]);
  if (!canManageAsOwner)
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState title={t("ACCESS_DENIED", { ns: "errors" })} />
      </>
    );
  const scope = { organizationId, storeId };
  const workspace = `${organizationId}/${storeId}`;
  if (search.purchase)
    return (
      <PurchasePage
        key={`${workspace}/${search.purchase}`}
        scope={scope}
        id={search.purchase}
        supplierId={search.supplier}
      />
    );
  if (search.supplier)
    return (
      <SupplierPage
        key={`${workspace}/${search.supplier}`}
        scope={scope}
        id={search.supplier}
        currency={settings.defaultCurrency}
      />
    );
  return (
    <Directory
      key={workspace}
      scope={scope}
      currency={settings.defaultCurrency}
      view={search.view}
    />
  );
}

function Directory({
  scope,
  currency,
  view,
}: {
  scope: SupplierScope;
  currency: string;
  view?: SuppliersSearch["view"];
}) {
  const { t } = useTranslation("suppliers");
  const navigate = useNavigate({ from: "/suppliers" });
  const [form, setForm] = useState<FormPanel>();
  const closeForm = () => setForm(undefined);
  const createSupplier: MouseEventHandler<HTMLButtonElement> = (event) =>
    setForm({ kind: "supplier", opener: event.currentTarget });
  const createPurchase: MouseEventHandler<HTMLButtonElement> = (event) =>
    setForm({ kind: "purchase", opener: event.currentTarget });
  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className={controlClass}
              onClick={createPurchase}
            >
              {t("registerPurchase")}
            </Button>
            <Button
              type="button"
              className={controlClass}
              onClick={createSupplier}
            >
              <Plus aria-hidden="true" />
              {t("addSupplier")}
            </Button>
          </div>
        }
      />
      <Tabs
        value={view ?? "suppliers"}
        onValueChange={(value) =>
          void navigate({
            search: value === "purchases" ? { view: "purchases" } : {},
            replace: true,
          })
        }
      >
        <TabsList className="mb-2 h-auto!" aria-label={t("title")}>
          <TabsTrigger className={`${controlClass} h-auto!`} value="suppliers">
            {t("title")}
          </TabsTrigger>
          <TabsTrigger className={`${controlClass} h-auto!`} value="purchases">
            {t("purchases")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="suppliers">
          <SupplierList scope={scope} create={createSupplier} />
        </TabsContent>
        <TabsContent value="purchases">
          <Purchases scope={scope} create={createPurchase} />
        </TabsContent>
      </Tabs>
      {form?.kind === "supplier" && (
        <SupplierForm
          scope={scope}
          opener={form.opener}
          close={closeForm}
          saved={({ id }) => {
            closeForm();
            void navigate({ search: { supplier: id } });
          }}
        />
      )}
      {form?.kind === "purchase" && (
        <PurchaseForm
          scope={scope}
          opener={form.opener}
          defaultCurrency={currency}
          close={closeForm}
          saved={({ id, supplierId }) => {
            closeForm();
            void navigate({ search: { supplier: supplierId, purchase: id } });
          }}
        />
      )}
    </>
  );
}

function SupplierList({
  scope,
  create,
}: {
  scope: SupplierScope;
  create: MouseEventHandler<HTMLButtonElement>;
}) {
  const { t } = useTranslation("suppliers");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>();
  const [outstanding, setOutstanding] = useState(false);
  const q = useSupplierSearch(search);
  const filters = {
    q,
    active: status,
    outstanding: outstanding ? "true" : undefined,
  };
  const pagination = useCursorPagination(JSON.stringify(filters));
  const query = useQuery(suppliersQuery(scope, filters, pagination.request));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
        <TextFilter
          label={t("searchSuppliers")}
          value={search}
          set={setSearch}
        />
        <FilterSelect
          label={t("status")}
          value={status}
          set={setStatus}
          options={[
            { value: "true", label: t("active") },
            { value: "false", label: t("inactive") },
          ]}
        />
        <Label
          className={`col-span-2 flex cursor-pointer items-center gap-2 sm:col-span-1 ${controlClass}`}
        >
          <Checkbox
            checked={outstanding}
            onCheckedChange={(value) => setOutstanding(value === true)}
          />
          {t("hasOutstanding")}
        </Label>
      </div>
      <Listing
        query={query}
        pagination={pagination}
        label={t("title")}
        empty={t("noSuppliers")}
        action={
          !q &&
          !status &&
          !outstanding && (
            <Button type="button" className={controlClass} onClick={create}>
              {t("addSupplier")}
            </Button>
          )
        }
      >
        {(items) => (
          <LedgerRows
            columns={[
              t("fields.name"),
              t("fields.contactPerson"),
              t("fields.phone"),
              t("status"),
            ]}
            rows={items.map((supplier) => ({
              id: supplier.id,
              cells: [
                <Link
                  to="/suppliers"
                  search={{ supplier: supplier.id }}
                  className="inline-flex min-h-11 items-center font-medium underline underline-offset-2 lg:min-h-0"
                >
                  {supplier.name}
                </Link>,
                supplier.contactPerson,
                supplier.phone,
                <SupplierStatus supplier={supplier} />,
              ],
            }))}
          />
        )}
      </Listing>
    </div>
  );
}

function SupplierStatus({ supplier }: { supplier: Supplier }) {
  const { t } = useTranslation("suppliers");
  return (
    <Badge variant={supplier.isActive ? "success" : "outline"}>
      {t(supplier.isActive ? "active" : "inactive")}
    </Badge>
  );
}

function Back({ search, label }: { search: SuppliersSearch; label: string }) {
  return (
    <Button variant="ghost" className={`mb-2 ${controlClass}`} asChild>
      <Link to="/suppliers" search={search}>
        <ArrowLeft aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}

function SupplierPage({
  scope,
  id,
  currency,
}: {
  scope: SupplierScope;
  id: string;
  currency: string;
}) {
  const { t } = useTranslation("suppliers");
  const navigate = useNavigate({ from: "/suppliers" });
  const query = useQuery(supplierQuery(scope, id));
  const [form, setForm] = useState<FormPanel>();
  const [error, setError] = useState<unknown>();
  const toggle = useSaveSupplier(scope, id);
  if (query.isPending) return <ListSkeleton rows={4} />;
  if (!query.data)
    return (
      <>
        <Back search={{}} label={t("title")} />
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
          pending={query.isFetching}
        />
      </>
    );
  const { supplier } = query.data;
  const closeForm = () => setForm(undefined);
  const createPurchase: MouseEventHandler<HTMLButtonElement> | undefined =
    supplier.isActive
      ? (event) => setForm({ kind: "purchase", opener: event.currentTarget })
      : undefined;
  return (
    <>
      <Back search={{}} label={t("title")} />
      <PageHeader
        title={supplier.name}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              type="button"
              className={controlClass}
              disabled={toggle.isPending}
              onClick={(event) =>
                setForm({ kind: "supplier", opener: event.currentTarget })
              }
            >
              {t("editSupplier")}
            </Button>
            {createPurchase && (
              <Button
                type="button"
                className={controlClass}
                disabled={toggle.isPending}
                onClick={createPurchase}
              >
                {t("registerPurchase")}
              </Button>
            )}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SupplierStatus supplier={supplier} />
        <PendingButton
          variant="outline"
          type="button"
          pending={toggle.isPending}
          className={controlClass}
          onClick={async () => {
            setError(undefined);
            try {
              const saved = await toggle.mutateAsync({
                isActive: !supplier.isActive,
              });
              toast.success(t(saved.isActive ? "reactivated" : "deactivated"));
            } catch (cause) {
              setError(cause);
            }
          }}
        >
          {t(supplier.isActive ? "deactivate" : "reactivate")}
        </PendingButton>
        <WriteError error={error} />
      </div>
      {query.isError && (
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
          pending={query.isFetching}
        />
      )}
      <Tabs defaultValue="overview">
        <div className="pb-2 pt-1">
          <TabsList
            className="grid h-auto! w-full grid-cols-3 gap-1 sm:flex sm:w-fit"
            aria-label={t("supplier")}
          >
            {(
              [
                "overview",
                "products",
                "purchases",
                "payments",
                "activity",
              ] as const
            ).map((section) => (
              <TabsTrigger
                key={section}
                className={`${controlClass} h-auto! whitespace-normal`}
                value={section}
              >
                {t(section)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview">
          <Overview overview={query.data} />
        </TabsContent>
        <TabsContent value="products">
          <SupplierProducts scope={scope} supplierId={supplier.id} />
        </TabsContent>
        <TabsContent value="purchases">
          <Purchases
            scope={scope}
            supplierId={supplier.id}
            create={createPurchase}
          />
        </TabsContent>
        <TabsContent value="payments">
          <Payments scope={scope} supplierId={supplier.id} />
        </TabsContent>
        <TabsContent value="activity">
          <Activity scope={scope} supplierId={supplier.id} />
        </TabsContent>
      </Tabs>
      {form?.kind === "supplier" && (
        <SupplierForm
          scope={scope}
          opener={form.opener}
          close={closeForm}
          supplier={supplier}
          saved={closeForm}
        />
      )}
      {form?.kind === "purchase" && (
        <PurchaseForm
          scope={scope}
          opener={form.opener}
          defaultCurrency={currency}
          initialSupplier={{ id: supplier.id, name: supplier.name }}
          close={closeForm}
          saved={({ id, supplierId }) => {
            closeForm();
            void navigate({ search: { supplier: supplierId, purchase: id } });
          }}
        />
      )}
    </>
  );
}

function Overview({ overview }: { overview: SupplierOverview }) {
  const { t } = useTranslation("suppliers");
  const { supplier } = overview;
  const contact = (
    ["contactPerson", "phone", "email", "address", "taxId", "note"] as const
  ).filter((field) => supplier[field]);
  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <Fact label={t("purchaseCount")}>{overview.purchaseCount}</Fact>
        <Fact label={t("productCount")}>{overview.productCount}</Fact>
        <Fact label={t("lastPurchase")}>
          {overview.lastPurchaseDate ? (
            <CalendarDate value={overview.lastPurchaseDate} />
          ) : (
            "—"
          )}
        </Fact>
        <Fact label={t("lastPayment")}>
          {overview.lastPaymentDate ? (
            <CalendarDate value={overview.lastPaymentDate} />
          ) : (
            "—"
          )}
        </Fact>
      </dl>
      {overview.balances.length > 0 && (
        <LedgerRows
          columns={[t("currency"), t("purchased"), t("paid"), t("outstanding")]}
          rows={overview.balances.map(
            ({ currency, purchased, paid, outstanding }) => ({
              id: currency,
              cells: [
                currency,
                <Payable value={purchased} />,
                <Payable value={paid} />,
                <strong>
                  <Payable value={outstanding} />
                </strong>,
              ],
            }),
          )}
        />
      )}
      {!overview.balances.length && (
        <p role="status" className="text-muted-foreground">
          {t("noPurchases")}
        </p>
      )}
      {contact.length > 0 && (
        <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-3">
          {contact.map((field) => (
            <Fact key={field} label={t(`fields.${field}`)}>
              {supplier[field]}
            </Fact>
          ))}
        </dl>
      )}
    </div>
  );
}

function PurchasePage({
  scope,
  id,
  supplierId,
}: {
  scope: SupplierScope;
  id: string;
  supplierId?: string;
}) {
  const { t, i18n } = useTranslation(["suppliers", "products", "auth"]);
  const query = useQuery(purchaseQuery(scope, id));
  const [paying, setPaying] = useState(false);
  if (query.isPending) return <ListSkeleton rows={4} />;
  if (!query.data)
    return (
      <>
        <Back search={{ supplier: supplierId }} label={t("title")} />
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
          pending={query.isFetching}
        />
      </>
    );
  const purchase = query.data;
  const locale = i18n.resolvedLanguage ?? "az";
  return (
    <>
      <Back
        search={{ supplier: purchase.supplier.id }}
        label={purchase.supplier.name}
      />
      <PageHeader
        title={
          purchase.documentNumber
            ? t("purchaseTitle", { number: purchase.documentNumber })
            : t("purchase")
        }
        actions={
          !paying &&
          purchase.status !== "PAID" && (
            <Button
              type="button"
              className={controlClass}
              onClick={() => setPaying(true)}
            >
              {t("recordPayment")}
            </Button>
          )
        }
      />
      <div className="grid gap-4">
        {query.isError && (
          <ErrorState
            error={query.error}
            retry={() => void query.refetch()}
            pending={query.isFetching}
          />
        )}
        <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-4">
          <Fact label={t("purchaseDate")}>
            <CalendarDate value={purchase.purchaseDate} />
          </Fact>
          <Fact label={t("purchased")}>
            <Payable value={purchase.total} />
          </Fact>
          <Fact label={t("paid")}>
            <Payable value={purchase.paid} />
          </Fact>
          <Fact label={t("outstanding")}>
            <strong>
              <Payable value={purchase.outstanding} />
            </strong>
          </Fact>
          <Fact label={t("status")}>
            <PurchaseStatus value={purchase.status} />
          </Fact>
          <Fact label={t("productCount")}>{purchase.productCount}</Fact>
          <Fact label={t("actor")}>
            {purchase.actorName ?? t("unknownActor", { ns: "auth" })}
          </Fact>
          <Fact label={t("recordedAt")}>
            <time dateTime={purchase.createdAt}>
              {formatDateTime(purchase.createdAt, locale)}
            </time>
          </Fact>
          {purchase.note && (
            <Fact label={t("fields.note")}>{purchase.note}</Fact>
          )}
        </dl>
        {paying && (
          <PaymentForm
            scope={scope}
            purchase={purchase}
            close={() => setPaying(false)}
          />
        )}
        <section className="grid gap-3">
          <h2 className="font-semibold">{t("products")}</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {purchase.products.map((product) => (
              <li key={product.id} className="grid gap-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to="/products"
                    search={{ product: product.id }}
                    className="inline-flex min-h-11 max-w-full items-center font-medium wrap-anywhere underline underline-offset-2 lg:min-h-0"
                  >
                    {product.code} · {product.name}
                  </Link>
                  <strong>
                    <Payable value={product.acquisitionCost} />
                  </strong>
                </div>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  <Fact label={t("fields.category", { ns: "products" })}>
                    {product.productCategory?.code
                      ? categoryLabel(product.productCategory, locale)
                      : product.category}
                  </Fact>
                  <Fact label={t("fields.metalType", { ns: "products" })}>
                    {t("jewelry.gold", { ns: "products" })}
                  </Fact>
                  <Fact label={t("fields.purity", { ns: "products" })}>
                    {product.purity}
                  </Fact>
                  <Fact label={t("fields.weight", { ns: "products" })}>
                    <WeightText value={product.weight} />
                  </Fact>
                  {product.netGoldWeight && (
                    <Fact label={t("fields.netGoldWeight", { ns: "products" })}>
                      <WeightText value={product.netGoldWeight} />
                    </Fact>
                  )}
                </dl>
                {(Boolean(product.gemstones?.length) ||
                  product.acquisitionCostPerGram ||
                  acquisitionComponents.some(
                    (part) =>
                      product.acquisitionBreakdown?.[part] !== undefined,
                  )) && (
                  <details>
                    <summary
                      className={`w-fit cursor-pointer content-center font-medium ${controlClass}`}
                    >
                      {t("acquisitionDetails")}
                    </summary>
                    <dl className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-4">
                      {product.acquisitionCostPerGram && (
                        <Fact
                          label={t("fields.acquisitionCostPerGram", {
                            ns: "products",
                          })}
                        >
                          <Payable value={product.acquisitionCostPerGram} />
                        </Fact>
                      )}
                      {acquisitionComponents.map((part) => {
                        const amount = product.acquisitionBreakdown?.[part];
                        return amount === undefined ? null : (
                          <Fact
                            key={part}
                            label={t(`jewelry.components.${part}`, {
                              ns: "products",
                            })}
                          >
                            <Payable
                              value={{
                                amount,
                                currency: purchase.total.currency,
                              }}
                            />
                          </Fact>
                        );
                      })}
                    </dl>
                    {product.gemstones?.map((group, index) => (
                      <div key={index} className="grid gap-2 border-t py-3">
                        <h3 className="font-medium wrap-anywhere">
                          {group.gemstoneType}
                        </h3>
                        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Fact
                            label={t("jewelry.stoneFields.stoneCount", {
                              ns: "products",
                            })}
                          >
                            {group.stoneCount}
                          </Fact>
                          <Fact
                            label={t("jewelry.stoneFields.origin", {
                              ns: "products",
                            })}
                          >
                            {t(`jewelry.origins.${group.origin ?? "UNKNOWN"}`, {
                              ns: "products",
                            })}
                          </Fact>
                          {(["totalCarats", "individualCarats"] as const).map(
                            (field) => {
                              const amount = group[field];
                              return (
                                amount && (
                                  <Fact
                                    key={field}
                                    label={t(`jewelry.stoneFields.${field}`, {
                                      ns: "products",
                                    })}
                                  >
                                    {t("jewelry.carats", {
                                      amount: formatDecimal(amount, locale),
                                      ns: "products",
                                    })}
                                  </Fact>
                                )
                              );
                            },
                          )}
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
                                  label={t(`jewelry.stoneFields.${field}`, {
                                    ns: "products",
                                  })}
                                >
                                  {group[field]}
                                </Fact>
                              ),
                          )}
                        </dl>
                      </div>
                    ))}
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="grid gap-3">
          <h2 className="font-semibold">{t("payments")}</h2>
          <Payments
            scope={scope}
            supplierId={purchase.supplier.id}
            purchaseId={purchase.id}
          />
        </section>
      </div>
    </>
  );
}
