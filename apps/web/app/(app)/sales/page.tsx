import Link from "next/link";
import { Gem, Plus, Search } from "lucide-react";
import { redirect } from "next/navigation";
import type { SaleList } from "@mizan/contracts";
import { actionClass, Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { Surface } from "../../../components/ui/surface";
import { apiRequest } from "../../../features/auth/session";
import { productHref } from "../../../features/products/product-copy";
import {
  productPage,
  type ProductSearch,
} from "../../../features/products/product-page";
import { saleCopy } from "../../../features/sales/sale-copy";
import { money } from "../../../features/sales/settlement-summary";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: ProductSearch & Promise<{ date?: string }>;
}) {
  const { scope, locale, copy, query, fallback } = await productPage(
    searchParams,
    "/sales",
  );
  if (!scope) return fallback;
  const labels = saleCopy[locale];
  const rawDate = (await searchParams).date;
  const date = typeof rawDate === "string" ? rawDate : "";
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const after = typeof query.after === "string" ? query.after : "";
  const url = productHref("/sales", scope, { q, date, after });
  const response = await apiRequest(url as `/sales${string}`);
  if (response.status === 401) redirect("/sign-in");
  const result = response.data as SaleList | undefined;
  const time = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Baku",
  });
  return (
    <section className="grid gap-4">
      <div className="mizan-page-heading">
        <div>
          <h1>{labels.history}</h1>
          <p>{labels.historyDescription}</p>
        </div>
        <Link
          className={actionClass + " mizan-page-action"}
          href={productHref("/sales/new", scope)}
        >
          <Plus size={19} aria-hidden />
          {labels.title}
        </Link>
      </div>
      <Surface className="p-3">
        <form action="/sales" className="flex flex-wrap items-center gap-2">
          <input
            type="hidden"
            name="organizationId"
            value={scope.organizationId}
          />
          <input type="hidden" name="storeId" value={scope.storeId} />
          <div className="relative w-full sm:max-w-92">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute top-3.5 left-3 text-mizan-muted"
            />
            <input
              className="mizan-table-input w-full pl-9"
              aria-label={labels.historySearch}
              placeholder={labels.historySearch}
              key={q}
              name="q"
              type="search"
              maxLength={160}
              defaultValue={q}
            />
          </div>
          <input
            className="mizan-table-input"
            aria-label={labels.date}
            name="date"
            type="date"
            key={date}
            defaultValue={date}
          />
          <Button type="submit" variant="secondary">
            {copy.find}
          </Button>
          <Link
            className={actionClass + " mizan-table-action"}
            href={productHref("/sales", scope)}
          >
            {copy.reset}
          </Link>
        </form>
      </Surface>
      <Surface className="min-w-0 px-3 sm:px-4">
        {!result ? (
          <p role="alert">{labels.resultFailed}</p>
        ) : result.items.length === 0 ? (
          <p>{labels.historyEmpty}</p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label={labels.history}
            className="overflow-x-auto"
          >
            <table className="mizan-record-table min-w-205">
              <thead>
                <tr>
                  {[
                    labels.reference,
                    labels.date,
                    copy.name,
                    labels.weight,
                    labels.amount,
                    labels.paymentMethod,
                    labels.actor,
                    labels.status,
                    labels.view,
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((sale) => (
                  <tr key={sale.id}>
                    <th
                      scope="row"
                      title={sale.id}
                      className="whitespace-nowrap"
                    >
                      {sale.id.slice(0, 8)}
                    </th>
                    <td className="whitespace-nowrap">
                      <time dateTime={sale.createdAt}>
                        {time.format(new Date(sale.createdAt))}
                      </time>
                    </td>
                    <td className="min-w-38">
                      <span className="flex items-center gap-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mizan-selected">
                          <Gem size={16} aria-hidden />
                        </span>
                        <span>
                          <strong className="block">{sale.product.name}</strong>
                          <small>{sale.product.code}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      {sale.product.weight.replace(
                        ".",
                        locale === "az" ? "," : ".",
                      )}{" "}
                      {locale === "az" ? "q" : "g"}
                    </td>
                    <td>
                      <strong>
                        {money(locale, sale.saleAmount, sale.currency)}
                      </strong>
                    </td>
                    <td>
                      {sale.paymentCurrency
                        ? labels.cashMethod + " · " + sale.paymentCurrency
                        : sale.balance.startsWith("-")
                          ? labels.payout
                          : labels.even}
                    </td>
                    <td title={sale.actorId}>{sale.actorId.slice(0, 8)}</td>
                    <td>
                      <StatusBadge>{labels.completed}</StatusBadge>
                    </td>
                    <td>
                      <Link
                        className={actionClass + " mizan-table-action"}
                        href={productHref("/sales/" + sale.id, scope)}
                      >
                        {labels.view}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!!result?.items.length && (
          <div className="flex items-center justify-between gap-2 border-t border-mizan-edge/40 py-3 text-xs text-mizan-muted">
            <span>
              {result.items.length} {labels.records}
            </span>
            {result.nextCursor && (
              <Link
                className={actionClass + " mizan-table-action"}
                href={productHref("/sales", scope, {
                  q,
                  date,
                  after: result.nextCursor,
                })}
              >
                {copy.next}
              </Link>
            )}
          </div>
        )}
      </Surface>
    </section>
  );
}
