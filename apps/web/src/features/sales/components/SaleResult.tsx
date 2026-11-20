import { useQuery } from "@tanstack/react-query";
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

export function SaleDate({ value }: { value: string }) {
  const { i18n } = useTranslation("sales");
  return (
    <time dateTime={value}>{formatDateTime(value, i18n.resolvedLanguage)}</time>
  );
}

export function SaleDetail({ scope, id }: { scope: SaleScope; id: string }) {
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
  return <SaleRecord sale={detail.data} />;
}

function SaleRecord({ sale }: { sale: Result }) {
  const { t } = useTranslation("sales");
  const { canManageAsOwner } = useWorkspace();
  const money = (amount: string, currency = sale.currency) => (
    <MoneyText value={{ amount, currency }} />
  );
  return (
    <div className="grid gap-6">
      <p className="text-xs text-muted-foreground">
        <SaleDate value={sale.createdAt} />
      </p>
      <dl className="grid grid-cols-2 gap-4 border-t pt-4">
        <Fact label={t("fields.saleTotal")}>{money(sale.saleAmount)}</Fact>
        <Fact label={t("fields.tradeInTotal")}>{money(sale.tradeInTotal)}</Fact>
        <Fact label={t("fields.balance")}>{money(sale.balance)}</Fact>
        <Fact label={t("fields.payout")}>{money(sale.payout)}</Fact>
      </dl>
      <section className="grid gap-3 border-t pt-4">
        <h3 className="font-medium">{t("soldProducts")}</h3>
        <ul className="divide-y rounded-lg border">
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
        <section className="grid gap-3 border-t pt-4">
          <h3 className="font-medium">{t("saleProfit")}</h3>
          <dl className="grid grid-cols-2 gap-3">
            <ProfitFacts profit={sale.profit} currency={sale.currency} />
          </dl>
        </section>
      )}
      <section className="grid gap-3 border-t pt-4">
        <h3 className="font-medium">{t("payment")}</h3>
        {sale.payment ? (
          <dl className="grid grid-cols-2 gap-4">
            <Fact label={t("fields.paymentAmount")}>
              {money(sale.payment.amount, sale.payment.currency)}
            </Fact>
            <Fact label={t("fields.exchangeRate")}>
              <span className="tabular-nums">{sale.payment.exchangeRate}</span>
            </Fact>
            <Fact label={t("fields.convertedAmount")}>
              {money(sale.payment.convertedAmount)}
            </Fact>
            <Fact label={t("fields.change")}>{money(sale.payment.change)}</Fact>
          </dl>
        ) : (
          <p className="text-muted-foreground">{t("noPayment")}</p>
        )}
      </section>
      <section className="grid gap-3 border-t pt-4">
        <h3 className="font-medium">{t("tradeIns")}</h3>
        {sale.tradeIns.length === 0 ? (
          <p className="text-muted-foreground">{t("noTradeIns")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sale.tradeIns.map((trade) => (
              <li key={trade.id} className="p-3">
                <dl className="grid grid-cols-2 gap-3">
                  <Fact label={t("fields.purity")}>
                    <PurityText value={trade.purity} />
                  </Fact>
                  <Fact label={t("fields.weight")}>
                    <WeightText value={trade.weight} />
                  </Fact>
                  <Fact label={t("fields.rate")}>
                    {money(trade.appliedRate)}
                  </Fact>
                  <Fact label={t("fields.calculatedValue")}>
                    {money(trade.calculatedValue)}
                  </Fact>
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
          <span className={loss ? "font-medium text-destructive" : undefined}>
            <MoneyText value={{ amount: profit.grossProfit, currency }} />
          </span>
        )}
      </Fact>
      <Fact label={t("fields.profitMargin")}>
        {profit.marginPercent === null ? (
          t("notAvailable")
        ) : (
          <span
            className={loss ? "tabular-nums text-destructive" : "tabular-nums"}
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
