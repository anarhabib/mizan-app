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
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CustomerSummary, MoneyInput } from "@mizan/contracts";
import { Button } from "@/components/ui/button";
import { ProductPanel } from "@/features/products";
import { SalePaymentStatusBadge, SaleRepayment } from "@/features/sales";
import { useWorkspace } from "@/features/workspace";
import { apiRequest, ApiError } from "@/shared/lib/api";
import { formatDateTime } from "@/shared/lib/format";
import { EmptyState } from "@/shared/ui/EmptyState";
import { CursorPagination } from "@/shared/ui/CursorPagination";
import { useCursorPagination } from "@/shared/hooks/useCursorPagination";
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

type Props = {
  id?: string;
  create?: boolean;
  outstanding?: boolean;
  closeLinkedCustomer: () => void;
};
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
      {customer.netPurchases && (
        <Amount label={t("returns.netTotal")} value={customer.netPurchases} />
      )}
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
  create,
  outstanding,
  scope,
  closeLinkedCustomer,
  canManageAsOwner,
}: Props & {
  scope: CustomerScope;
  canManageAsOwner: boolean;
}) {
  const { t } = useTranslation("customers");
  const { t: dashboard } = useTranslation("dashboard");
  const [panel, setPanel] = useState<Panel>();
  const [createButton, setCreateButton] = useState<HTMLButtonElement | null>(
    null,
  );
  const createPanel =
    panel?.kind === "create"
      ? panel
      : !panel && create && createButton
        ? { opener: createButton }
        : undefined;
  const detail =
    panel?.kind === "detail"
      ? panel
      : id && createButton
        ? { id, opener: createButton }
        : undefined;
  const [saving, setSaving] = useState(false);
  const close = () => {
    setPanel(undefined);
    if (id || create) closeLinkedCustomer();
  };

  return (
    <>
      <PageHeader
        title={outstanding ? dashboard("widgets.debtors") : t("title")}
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
      {outstanding && (
        <Link
          to="/customers"
          className="mb-3 inline-flex min-h-10 items-center underline underline-offset-4"
        >
          {dashboard("allCustomers")}
        </Link>
      )}
      <CustomerSearch
        paged
        scope={scope}
        outstanding={outstanding}
        render={(row) => (
          <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center">
            <div className="min-w-0">
              <Button
                variant="ghost"
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center rounded-sm text-left font-medium underline underline-offset-4 wrap-anywhere focus-visible:outline-2 focus-visible:outline-ring lg:min-h-9 h-auto justify-start px-0 whitespace-normal"
                onClick={(event) =>
                  setPanel({
                    kind: "detail",
                    id: row.id,
                    opener: event.currentTarget,
                  })
                }
              >
                {row.name}
              </Button>
              <p className="text-muted-foreground wrap-anywhere">{row.phone}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <CustomerFacts customer={row} />
            </dl>
          </div>
        )}
      />
      {createPanel ? (
        <ProductPanel
          title={t("create")}
          opener={createPanel.opener}
          close={close}
          busy={saving}
        >
          <CustomerForm
            scope={scope}
            onSubmittingChange={setSaving}
            close={close}
            saved={(customer) =>
              setPanel({
                kind: "detail",
                id: customer.id,
                opener: createPanel.opener,
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
  const [view, setView] = useState<"detail" | "edit">("detail");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const detail = useQuery(customerDetailQuery(scope, id));
  const customer = detail.data;
  const client = useQueryClient();
  const removal = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: () => apiRequest(customerPath(scope, id), { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("deleted"));
      close();
      void invalidateCustomers(client, scope, id);
    },
    onError: () => void invalidateCustomers(client, scope, id),
  });
  const [saving, setSaving] = useState(false);
  const [pendingRepayments, setPendingRepayments] = useState(0);
  const showDetail = () => setView("detail");

  return (
    <ProductPanel
      title={view === "detail" ? (customer?.name ?? t("detail")) : t("edit")}
      opener={opener}
      close={close}
      busy={removal.isPending || saving || pendingRepayments > 0}
      restoreFallbackFocus={restoreFallbackFocus}
    >
      {view === "edit" && customer ? (
        <CustomerForm
          scope={scope}
          onSubmittingChange={setSaving}
          customer={customer}
          close={showDetail}
          saved={showDetail}
        />
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
                  disabled={pendingRepayments > 0}
                  onClick={() => setView("edit")}
                >
                  {t("edit")}
                </Button>
                {canManageAsOwner &&
                  (!customer.lastPurchaseAt || confirmDelete) && (
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
                          className={buttonHeight}
                          disabled={
                            Boolean(customer.lastPurchaseAt) ||
                            pendingRepayments > 0
                          }
                        >
                          {t("delete")}
                        </Button>
                      </AlertDialogTrigger>
                      <ConfirmationContent
                        onEscapeKeyDown={(event) => {
                          if (removal.isPending) event.preventDefault();
                        }}
                      >
                        <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("confirmDelete", { name: customer.name })}
                        </AlertDialogDescription>
                        {removal.isError && (
                          <p role="alert" className="text-destructive">
                            {t(
                              removal.error instanceof ApiError &&
                                removal.error.code ===
                                  "CUSTOMER_DELETE_CONFLICT"
                                ? "deleteConflict"
                                : "deleteFailed",
                            )}
                          </p>
                        )}
                        <div className="flex flex-wrap justify-end gap-2">
                          <AlertDialogCancel asChild>
                            <Button
                              variant="outline"
                              className={buttonHeight}
                              disabled={removal.isPending}
                            >
                              {t("cancel")}
                            </Button>
                          </AlertDialogCancel>
                          <PendingButton
                            pending={removal.isPending}
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
                          </PendingButton>
                        </div>
                      </ConfirmationContent>
                    </AlertDialog>
                  )}
              </div>
              <PurchaseHistory
                scope={scope}
                id={id}
                onRepaymentSubmittingChange={(submitting) =>
                  setPendingRepayments((count) => count + (submitting ? 1 : -1))
                }
              />
            </>
          )}
        </div>
      )}
    </ProductPanel>
  );
}

function PurchaseHistory({
  scope,
  id,
  onRepaymentSubmittingChange,
}: {
  scope: CustomerScope;
  id: string;
  onRepaymentSubmittingChange: (submitting: boolean) => void;
}) {
  const { t } = useTranslation("customers");
  const pagination = useCursorPagination(id);
  const history = useQuery(customerHistoryQuery(scope, id, pagination.request));
  const rows = history.data?.items ?? [];
  return (
    <section aria-busy={history.isFetching} className="grid gap-3">
      <h2 className="font-medium">{t("history")}</h2>
      {history.isPending && <ListSkeleton rows={3} />}
      {history.isError && (
        <ErrorState
          error={history.error}
          pending={history.isFetching}
          retry={() => void history.refetch()}
        />
      )}
      {history.isSuccess && !history.isPlaceholderData && !rows.length && (
        <EmptyState title={t("emptyHistory")} />
      )}
      {rows.length > 0 && (
        <ul
          inert={history.isPlaceholderData}
          className="divide-y rounded-lg border bg-card"
        >
          {rows.map((sale) => {
            const hasDebt = !/^0(?:\.0+)?$/.test(sale.outstandingDebt.amount);
            const hasPaid = !/^0(?:\.0+)?$/.test(sale.paidAmount.amount);
            return (
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
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <DateText value={sale.createdAt} />
                    {sale.returnStatus !== "RETURNED" && (
                      <SalePaymentStatusBadge
                        status={
                          hasDebt
                            ? hasPaid
                              ? "PARTIALLY_PAID"
                              : "UNPAID"
                            : "PAID"
                        }
                      />
                    )}
                    {sale.returnStatus && (
                      <span>{t(`returns.${sale.returnStatus}`)}</span>
                    )}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Amount label={t("purchaseTotal")} value={sale.total} />
                  {sale.returnedValue && (
                    <Amount
                      label={t("returns.value")}
                      value={sale.returnedValue}
                    />
                  )}
                  {sale.netTotal && (
                    <Amount
                      label={t("returns.netTotal")}
                      value={sale.netTotal}
                    />
                  )}
                  <Amount
                    label={t("tradeInCredit")}
                    value={sale.tradeInCredit}
                  />
                  <Amount label={t("paidAmount")} value={sale.paidAmount} />
                  {sale.netPaidAmount && (
                    <Amount
                      label={t("returns.netPaid")}
                      value={sale.netPaidAmount}
                    />
                  )}
                  <Amount label={t("debt")} value={sale.outstandingDebt} />
                </dl>
                {hasDebt && (
                  <SaleRepayment
                    scope={scope}
                    saleId={sale.id}
                    customerId={id}
                    outstanding={sale.outstandingDebt}
                    onSubmittingChange={onRepaymentSubmittingChange}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={history.data?.nextCursor}
        pending={history.isPending || history.isPlaceholderData}
        label={t("history")}
      />
    </section>
  );
}
