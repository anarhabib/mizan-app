import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { SaleProfit, SaleResult as Result } from "@mizan/contracts";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/features/workspace";
import { formatDateTime } from "@/shared/lib/format";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ListSkeleton } from "@/shared/ui/ListSkeleton";
import { MoneyText } from "@/shared/ui/MoneyText";
import { PurityText } from "@/shared/ui/PurityText";
import { WeightText } from "@/shared/ui/WeightText";
import { saleDetailQuery, type SaleScope } from "../api/queries";
import { SaleRepayment } from "./SaleRepayment";
import { SalePaymentStatusBadge } from "./SalePaymentStatusBadge";
import { SaleTotals } from "./SaleTotals";

export function SaleDate({ value }: { value: string }) {
  const { i18n } = useTranslation("sales");
  return (
    <time dateTime={value}>{formatDateTime(value, i18n.resolvedLanguage)}</time>
  );
}

export function SaleDetail({
  scope,
  id,
  onRepaymentSubmittingChange,
}: {
  scope: SaleScope;
  id: string;
  onRepaymentSubmittingChange: (submitting: boolean) => void;
}) {
  const detail = useQuery(saleDetailQuery(scope, id));
  if (detail.isError)
    return (
      <ErrorState
        error={detail.error}
        pending={detail.isFetching}
        retry={() => void detail.refetch()}
      />
    );
  if (detail.isPending) return <ListSkeleton rows={3} />;
  return (
    <SaleRecord
      sale={detail.data}
      scope={scope}
      onRepaymentSubmittingChange={onRepaymentSubmittingChange}
    />
  );
}

function SaleRecord({
  sale,
  scope,
  onRepaymentSubmittingChange,
}: {
  sale: Result;
  scope: SaleScope;
  onRepaymentSubmittingChange: (submitting: boolean) => void;
}) {
  const { t } = useTranslation("sales");
  const { canManageAsOwner } = useWorkspace();
  const money = (amount: string, currency = sale.currency) => (
    <MoneyText value={{ amount, currency }} />
  );
  const outstanding = { amount: sale.outstandingDebt, currency: sale.currency };
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground">
          <SaleDate value={sale.createdAt} />
        </p>
        <SalePaymentStatusBadge status={sale.paymentStatus} />
        {sale.customerId && sale.customerName && (
          <Link
            to="/customers"
            search={{ customer: sale.customerId }}
            className="inline-flex min-h-11 min-w-0 items-center text-sm underline underline-offset-4 wrap-anywhere lg:min-h-9"
          >
            {sale.customerName}
          </Link>
        )}
      </div>

      <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
        <h3 className="font-medium">{t("soldProducts")}</h3>
        <ul className="divide-y rounded-lg border border-border bg-card">
          {sale.items.map(({ product, saleAmount, profit }) => (
            <li key={product.id} className="grid gap-3 p-3">
              <div className="grid gap-1">
                <h4 className="font-medium wrap-anywhere">{product.name}</h4>
                <p className="wrap-anywhere text-xs text-muted-foreground">
                  {product.code}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <Fact label={t("fields.saleAmount")}>{money(saleAmount)}</Fact>
                {canManageAsOwner && profit && (
                  <>
                    <Fact label={t("fields.acquisitionCostPerGram")}>
                      {profit.acquisitionCostPerGram ? (
                        <MoneyText value={profit.acquisitionCostPerGram} />
                      ) : (
                        t("notAvailable")
                      )}
                    </Fact>
                    <ProfitFacts profit={profit} currency={sale.currency} />
                  </>
                )}
              </dl>
            </li>
          ))}
        </ul>
      </section>
      {canManageAsOwner && sale.profit && sale.items.length > 1 && (
        <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
          <h3 className="font-medium">{t("saleProfit")}</h3>
          <dl className="grid grid-cols-2 gap-3">
            <ProfitFacts profit={sale.profit} currency={sale.currency} />
          </dl>
        </section>
      )}

      <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
        <h3 className="font-medium">{t("tradeIns")}</h3>
        {sale.tradeIns.length === 0 ? (
          <p className="text-muted-foreground">{t("noTradeIns")}</p>
        ) : (
          <ul className="divide-y rounded-lg border border-border bg-card">
            {sale.tradeIns.map((trade) => (
              <li key={trade.id} className="p-3">
                <dl className="grid grid-cols-2 gap-3">
                  <Fact label={t("fields.purity")}>
                    <PurityText value={trade.purity} />
                  </Fact>
                  <Fact label={t("fields.weight")}>
                    <WeightText value={trade.weight} />
                  </Fact>
                  {trade.appliedRate !== null && (
                    <Fact label={t("fields.rate")}>
                      {money(trade.appliedRate)}
                    </Fact>
                  )}
                  {trade.calculatedValue !== null && (
                    <Fact label={t("fields.calculatedValue")}>
                      {money(trade.calculatedValue)}
                    </Fact>
                  )}
                  <Fact
                    label={t(
                      trade.overridden
                        ? "fields.overrideAmount"
                        : "fields.acceptedValue",
                    )}
                  >
                    {money(trade.acceptedValue)}
                  </Fact>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SaleTotals
        total={{ amount: sale.saleAmount, currency: sale.currency }}
        tradeIn={{ amount: sale.tradeInTotal, currency: sale.currency }}
        paid={{ amount: sale.paidAmount, currency: sale.currency }}
        outstanding={outstanding}
      />
      {sale.payout !== "0" && (
        <dl>
          <Fact label={t("fields.payout")}>{money(sale.payout)}</Fact>
        </dl>
      )}
      {sale.customerId && sale.paymentStatus !== "PAID" && (
        <SaleRepayment
          scope={scope}
          saleId={sale.id}
          customerId={sale.customerId}
          outstanding={outstanding}
          onSubmittingChange={onRepaymentSubmittingChange}
        />
      )}

      <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
        <h3 className="font-medium">{t("paymentHistory")}</h3>
        {sale.payments.length > 0 ? (
          <ul className="divide-y rounded-lg border border-border bg-card">
            {sale.payments.map((payment) => (
              <li key={payment.id} className="grid gap-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {t(`paymentKind.${payment.kind}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <SaleDate value={payment.createdAt} />
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <Fact label={t("fields.paymentAmount")}>
                    {money(payment.amount, payment.currency)}
                  </Fact>
                  {payment.method && (
                    <Fact label={t("fields.paymentMethod")}>
                      {t(`methods.${payment.method}`)}
                    </Fact>
                  )}
                  {payment.currency !== sale.currency && (
                    <Fact label={t("fields.convertedAmount")}>
                      {money(payment.convertedAmount)}
                    </Fact>
                  )}
                  {payment.amountAzn !== null &&
                    payment.currency !== "AZN" &&
                    sale.currency !== "AZN" && (
                      <Fact label={t("fields.amountAzn")}>
                        {money(payment.amountAzn, "AZN")}
                      </Fact>
                    )}
                  {payment.exchangeRate !== "1" && (
                    <Fact label={t("fields.exchangeRate")}>
                      <span className="tabular-nums">
                        {payment.exchangeRate}
                      </span>
                    </Fact>
                  )}
                  {payment.change !== "0" && (
                    <Fact label={t("fields.change")}>
                      {money(payment.change)}
                    </Fact>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("noPayment")}</p>
        )}
      </section>
    </div>
  );
}

function ProfitFacts({
  profit,
  currency,
}: {
  profit: SaleProfit;
  currency: string;
}) {
  const { t, i18n } = useTranslation("sales");
  const loss = profit.grossProfit?.startsWith("-");
  return (
    <>
      <Fact label={t("fields.acquisitionCost")}>
        {profit.acquisitionCost ? (
          <MoneyText value={profit.acquisitionCost} />
        ) : (
          t("notAvailable")
        )}
      </Fact>
      <Fact label={t(loss ? "fields.grossLoss" : "fields.grossProfit")}>
        {profit.grossProfit === null ? (
          t("notAvailable")
        ) : (
          <span
            className={
              loss
                ? "font-medium text-danger-foreground"
                : "font-medium text-success-foreground"
            }
          >
            <MoneyText value={{ amount: profit.grossProfit, currency }} />
          </span>
        )}
      </Fact>
      <Fact label={t("fields.profitMargin")}>
        {profit.marginPercent === null ? (
          t("notAvailable")
        ) : (
          <span
            className={
              loss
                ? "tabular-nums text-danger-foreground"
                : "tabular-nums text-success-foreground"
            }
          >
            {t("percent", {
              value: i18n.resolvedLanguage?.startsWith("az")
                ? profit.marginPercent.replace(".", ",")
                : profit.marginPercent,
            })}
          </span>
        )}
      </Fact>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 wrap-anywhere">{children}</dd>
    </div>
  );
}
