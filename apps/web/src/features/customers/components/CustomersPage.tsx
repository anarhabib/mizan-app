import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CustomerSummary, MoneyInput } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { ProductPanel } from "@/features/products";
import { SaleRepayment } from "@/features/sales";
import { useWorkspace } from "@/features/workspace";
import { apiRequest, ApiError } from "@/shared/lib/api";
import { formatDateTime } from "@/shared/lib/format";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { MoneyText } from "@/shared/ui/MoneyText";
import { PageHeader } from "@/shared/ui/PageHeader";
import {
  customerDetailQuery,
  customerHistoryQuery,
  customerPath,
  invalidateCustomers,
  type CustomerScope,
} from "../api/queries";
import { CustomerForm } from "./CustomerForm";
import { CustomerSearch } from "./CustomerSearch";

type Props = { id?: string; closeLinkedCustomer: () => void };
type Panel =
  | { kind: "create"; opener: HTMLElement }
  | { kind: "detail"; id: string; opener: HTMLElement };
const buttonHeight = "min-h-11 lg:min-h-9";

export function CustomersPage(props: Props) {
  const { organizationId, storeId, canManageAsOwner } = useWorkspace();
  return (
    <ScopedCustomers
      key={`${organizationId}/${storeId}`}
      scope={{ organizationId, storeId }}
      canManageAsOwner={canManageAsOwner}
      {...props}
    />
  );
}

function DateText({ value }: { value: string }) {
  const { i18n } = useTranslation("customers");
  return (
    <time dateTime={value}>{formatDateTime(value, i18n.resolvedLanguage)}</time>
  );
}

function Amount({ label, value }: { label: string; value: MoneyInput }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium wrap-anywhere">
        <MoneyText value={value} />
      </dd>
    </div>
  );
}

function CustomerFacts({ customer }: { customer: CustomerSummary }) {
  const { t } = useTranslation("customers");
  return (
    <>
      <Amount label={t("purchases")} value={customer.totalPurchases} />
      <Amount label={t("debt")} value={customer.outstandingDebt} />
      <div>
        <dt className="text-xs text-muted-foreground">{t("lastPurchase")}</dt>
        <dd>
          {customer.lastPurchaseAt ? (
            <DateText value={customer.lastPurchaseAt} />
          ) : (
            t("noPurchase")
          )}
        </dd>
      </div>
    </>
  );
}

function ScopedCustomers({
  id,
  scope,
  closeLinkedCustomer,
  canManageAsOwner,
}: Props & {
  scope: CustomerScope;
  canManageAsOwner: boolean;
}) {
  const { t } = useTranslation("customers");
  const [panel, setPanel] = useState<Panel>();
  const [createButton, setCreateButton] = useState<HTMLButtonElement | null>(
    null,
  );
  const detail =
    panel?.kind === "detail"
      ? panel
      : id && createButton
        ? { id, opener: createButton }
        : undefined;
  const close = () => {
    setPanel(undefined);
    if (id) closeLinkedCustomer();
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button
            type="button"
            ref={setCreateButton}
            className={buttonHeight}
            onClick={(event) =>
              setPanel({ kind: "create", opener: event.currentTarget })
            }
          >
            <Plus aria-hidden="true" />
            {t("create")}
          </Button>
        }
      />
      <CustomerSearch
        scope={scope}
        render={(row) => (
          <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center">
            <div className="min-w-0">
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center rounded-sm text-left font-medium underline underline-offset-4 wrap-anywhere focus-visible:outline-2 focus-visible:outline-ring lg:min-h-9"
                onClick={(event) =>
                  setPanel({
                    kind: "detail",
                    id: row.id,
                    opener: event.currentTarget,
                  })
                }
              >
                {row.name}
              </button>
              <p className="text-muted-foreground wrap-anywhere">{row.phone}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <CustomerFacts customer={row} />
            </dl>
          </div>
        )}
      />
      {panel?.kind === "create" ? (
        <ProductPanel title={t("create")} opener={panel.opener} close={close}>
          <CustomerForm
            scope={scope}
            close={close}
            saved={(customer) =>
              setPanel({
                kind: "detail",
                id: customer.id,
                opener: panel.opener,
              })
            }
          />
        </ProductPanel>
      ) : (
        detail && (
          <CustomerDetailPanel
            key={detail.id}
            scope={scope}
            id={detail.id}
            opener={detail.opener}
            close={close}
            canManageAsOwner={canManageAsOwner}
            restoreFallbackFocus={() => createButton?.focus()}
          />
        )
      )}
    </>
  );
}

function CustomerDetailPanel({
  scope,
  id,
  opener,
  close,
  canManageAsOwner,
  restoreFallbackFocus,
}: {
  scope: CustomerScope;
  id: string;
  opener: HTMLElement;
  close: () => void;
  canManageAsOwner: boolean;
  restoreFallbackFocus: () => void;
}) {
  const { t } = useTranslation("customers");
  const [view, setView] = useState<"detail" | "edit" | "delete">("detail");
  const detail = useQuery(customerDetailQuery(scope, id));
  const customer = detail.data;
  const client = useQueryClient();
  const removal = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: () => apiRequest(customerPath(scope, id), { method: "DELETE" }),
    onSuccess: () => {
      close();
      void invalidateCustomers(client, scope, id);
    },
    onError: () => void invalidateCustomers(client, scope, id),
  });
  const showDetail = () => setView("detail");

  return (
    <ProductPanel
      title={view === "detail" ? (customer?.name ?? t("detail")) : t(view)}
      opener={opener}
      close={close}
      busy={removal.isPending}
      restoreFallbackFocus={restoreFallbackFocus}
      descriptionId={
        view === "delete" ? "customer-delete-description" : undefined
      }
    >
      {view === "edit" && customer ? (
        <CustomerForm
          scope={scope}
          customer={customer}
          close={showDetail}
          saved={showDetail}
        />
      ) : view === "delete" && customer ? (
        <div className="grid gap-4">
          <p id="customer-delete-description">
            {t("confirmDelete", { name: customer.name })}
          </p>
          {removal.isError && (
            <p role="alert" className="text-destructive">
              {t(
                removal.error instanceof ApiError &&
                  removal.error.code === "CUSTOMER_DELETE_CONFLICT"
                  ? "deleteConflict"
                  : "deleteFailed",
              )}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              autoFocus
              variant="outline"
              className={buttonHeight}
              disabled={removal.isPending}
              onClick={showDetail}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              className={buttonHeight}
              disabled={
                removal.isPending ||
                removal.isError ||
                Boolean(customer.lastPurchaseAt)
              }
              onClick={() => removal.mutate()}
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {detail.isPending && <ListSkeleton rows={3} />}
          {detail.isError && (
            <ErrorState
              error={detail.error}
              pending={detail.isFetching}
              retry={() => void detail.refetch()}
            />
          )}
          {customer && (
            <>
              <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">
                    {t("phone")}
                  </dt>
                  <dd className="wrap-anywhere">
                    <a
                      className="inline-flex min-h-11 items-center underline lg:min-h-0"
                      href={`tel:${customer.phone.replace(/[^+0-9]/g, "")}`}
                    >
                      {customer.phone}
                    </a>
                  </dd>
                </div>
                <CustomerFacts customer={customer} />
              </dl>
              {customer.note && (
                <section className="grid gap-2 rounded-lg border bg-card p-4">
                  <h2 className="font-medium">{t("note")}</h2>
                  <p className="whitespace-pre-wrap wrap-anywhere">
                    {customer.note}
                  </p>
                </section>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className={buttonHeight}
                  onClick={() => setView("edit")}
                >
                  {t("edit")}
                </Button>
                {canManageAsOwner && !customer.lastPurchaseAt && (
                  <Button
                    variant="destructive"
                    className={buttonHeight}
                    onClick={() => {
                      removal.reset();
                      setView("delete");
                    }}
                  >
                    {t("delete")}
                  </Button>
                )}
              </div>
              <PurchaseHistory scope={scope} id={id} />
            </>
          )}
        </div>
      )}
    </ProductPanel>
  );
}

function PurchaseHistory({ scope, id }: { scope: CustomerScope; id: string }) {
  const { t } = useTranslation("customers");
  const history = useInfiniteQuery(customerHistoryQuery(scope, id));
  const rows = history.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="grid gap-3">
      <h2 className="font-medium">{t("history")}</h2>
      {history.isPending && <ListSkeleton rows={3} />}
      {history.isError && (
        <ErrorState
          error={history.error}
          pending={history.isFetching}
          retry={() =>
            void (history.isFetchNextPageError
              ? history.fetchNextPage()
              : history.refetch())
          }
        />
      )}
      {!history.isPending && !history.isError && !rows.length && (
        <EmptyState title={t("emptyHistory")} />
      )}
      {rows.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((sale) => (
            <li key={sale.id} className="grid gap-3 p-3">
              <div className="min-w-0">
                <Link
                  to="/sales"
                  search={{ sale: sale.id }}
                  className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 wrap-anywhere lg:min-h-9"
                >
                  {t("purchaseLabel", {
                    product: sale.productName,
                    count: sale.itemCount,
                  })}
                </Link>
                <p className="text-xs text-muted-foreground">
                  <DateText value={sale.createdAt} />
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Amount label={t("purchaseTotal")} value={sale.total} />
                <Amount label={t("tradeInCredit")} value={sale.tradeInCredit} />
                <Amount label={t("paidAmount")} value={sale.paidAmount} />
                <Amount label={t("debt")} value={sale.outstandingDebt} />
              </dl>
              {!/^0(?:\.0+)?$/.test(sale.outstandingDebt.amount) && (
                <SaleRepayment
                  scope={scope}
                  saleId={sale.id}
                  customerId={id}
                  outstanding={sale.outstandingDebt}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {history.hasNextPage && !history.isFetchNextPageError && (
        <Button
          variant="outline"
          className={`justify-self-start ${buttonHeight}`}
          disabled={history.isFetching}
          onClick={() => void history.fetchNextPage()}
        >
          {t(history.isFetchingNextPage ? "loading" : "loadMore")}
        </Button>
      )}
    </section>
  );
}
