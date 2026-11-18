import Link from "next/link";
import { redirect } from "next/navigation";
import type { SaleResult } from "@mizan/contracts";
import { Surface } from "../../../../components/ui/surface";
import { actionClass } from "../../../../components/ui/button";
import { PageHeading } from "../../../../components/ui/page-heading";
import { apiRequest } from "../../../../features/auth/session";
import { productHref } from "../../../../features/products/product-copy";
import {
  productPage,
  type ProductSearch,
} from "../../../../features/products/product-page";
import { ProductIdentity } from "../../../../features/sales/product-lookup";
import { saleCopy } from "../../../../features/sales/sale-copy";
import {
  Rows,
  SettlementSummary,
} from "../../../../features/sales/settlement-summary";
import { money } from "../../../../lib/format-money";

export default async function SalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ProductSearch;
}) {
  const [{ id }, { scope, locale, copy, fallback }] = await Promise.all([
    params,
    productPage(searchParams, "/sales", {
      az: saleCopy.az.history,
      en: saleCopy.en.history,
    }),
  ]);
  if (!scope) return fallback;
  const labels = saleCopy[locale];
  const response = await apiRequest(
    productHref("/sales/" + encodeURIComponent(id), scope) as `/sales${string}`,
  );
  if (response.status === 401) redirect("/sign-in");
  const sale = response.data as SaleResult | undefined;
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Baku",
  });
  const show = (amount: string) => money(locale, amount, sale!.currency);
  return (
    <section className="grid min-w-0 gap-4">
      <PageHeading
        title={sale ? labels.saved : labels.history}
        actions={
          <Link
            className={actionClass + " mizan-table-action"}
            href={productHref("/sales", scope)}
          >
            {labels.backToSales}
          </Link>
        }
      />
      {sale ? (
        <>
          <div className="grid min-w-0 items-start gap-4 min-[1050px]:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Surface className="grid min-w-0 gap-4 p-4 sm:p-5">
              <Link
                className={
                  actionClass + " mizan-table-action justify-start text-left"
                }
                href={productHref(
                  "/products/" + encodeURIComponent(sale.product.id),
                  scope,
                )}
              >
                <ProductIdentity locale={locale} product={sale.product} />
              </Link>
              <Rows
                values={[
                  [labels.reference, sale.id],
                  [labels.date, date.format(new Date(sale.createdAt))],
                  [labels.actor, sale.actorId],
                ]}
              />
            </Surface>
            <Surface className="min-w-0 p-4 sm:p-5">
              <SettlementSummary
                locale={locale}
                currency={sale.currency}
                amount={sale.saleAmount}
                tradeInTotal={sale.tradeInTotal}
                balance={sale.balance}
                payment={sale.payment ?? undefined}
                converted={sale.payment?.convertedAmount ?? "0"}
                change={sale.payment?.change ?? "0"}
              />
            </Surface>
          </div>
          {sale.tradeIns.length > 0 && (
            <Surface className="grid gap-4 p-4">
              <h2 className="m-0 text-xl tracking-tight">{labels.trade}</h2>
              {sale.tradeIns.map((line) => (
                <Rows
                  key={line.id}
                  values={[
                    [copy.purity, String(line.purity)],
                    [
                      copy.weight,
                      locale === "az"
                        ? line.weight.replace(".", ",")
                        : line.weight,
                    ],
                    [labels.rate, show(line.appliedRate)],
                    [labels.calculated, show(line.calculatedValue)],
                    [
                      line.overridden
                        ? labels.accepted + " · " + labels.overrideApplied
                        : labels.accepted,
                      show(line.acceptedValue),
                    ],
                  ]}
                />
              ))}
            </Surface>
          )}
        </>
      ) : (
        <p role="alert">{labels.resultFailed}</p>
      )}
    </section>
  );
}
