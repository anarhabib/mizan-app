import Link from "next/link";
import { redirect } from "next/navigation";
import type { SaleResult } from "@mizan/contracts";
import { Surface } from "../../../../components/ui/surface";
import { apiRequest } from "../../../../features/auth/session";
import { productHref } from "../../../../features/products/product-copy";
import {
  productPage,
  type ProductSearch,
} from "../../../../features/products/product-page";
import { ProductIdentity } from "../../../../features/sales/product-lookup";
import { saleCopy } from "../../../../features/sales/sale-copy";
import {
  money,
  Rows,
  SettlementSummary,
} from "../../../../features/sales/settlement-summary";

export default async function SalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ProductSearch;
}) {
  const [{ id }, { scope, locale, copy, fallback }] = await Promise.all([
    params,
    productPage(searchParams),
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
    <section className="grid max-w-3xl gap-4">
      <Link className="w-fit underline" href={productHref("/products", scope)}>
        {copy.back}
      </Link>
      {sale ? (
        <>
          <h1>{labels.saved}</h1>
          <Surface className="grid gap-4 p-4">
            <Link
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
          <Surface tone="dark" className="p-4">
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
          {sale.tradeIns.length > 0 && (
            <Surface className="grid gap-4 p-4">
              <h2>{labels.trade}</h2>
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
