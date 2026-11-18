import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import type { ProductList as Inventory } from "@mizan/contracts";
import { Button, actionClass } from "../../components/ui/button";
import { Surface } from "../../components/ui/surface";
import { StatusBadge } from "../../components/ui/status-badge";
import type { Locale } from "../language/messages";
import { saleCopy } from "../sales/sale-copy";
import {
  productCopy,
  productHref,
  type ProductFilters,
  type ProductScope,
} from "./product-copy";

export function ProductList({
  locale,
  scope,
  filters,
  result,
}: {
  locale: Locale;
  scope: ProductScope;
  filters: ProductFilters;
  result?: Inventory;
}) {
  const copy = productCopy[locale];
  const home = productHref("/products", scope);
  return (
    <section className="grid gap-4">
      <div className="mizan-page-heading">
        <div>
          <h1>{copy.title}</h1>
          <p>
            {locale === "az"
              ? "Məhsul kartları, çəkilər və anbar statusu."
              : "Product records, weights, and stock status."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className={actionClass + " mizan-table-action"}
            href={productHref("/sales/new", scope)}
          >
            {saleCopy[locale].title}
          </Link>
          <Link
            className={actionClass + " mizan-page-action"}
            href={productHref("/products/new", scope)}
          >
            <Plus aria-hidden size={19} />
            {copy.add}
          </Link>
        </div>
      </div>
      <Surface className="p-3">
        <form action="/products" className="flex flex-wrap items-end gap-2">
          <input
            type="hidden"
            name="organizationId"
            value={scope.organizationId}
          />
          <input type="hidden" name="storeId" value={scope.storeId} />
          <div className="relative w-full flex-1 basis-48">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute top-3.5 left-3 text-mizan-muted"
            />
            <input
              key={filters.q}
              id="q"
              name="q"
              type="search"
              maxLength={160}
              aria-label={copy.search}
              placeholder={copy.search}
              className="mizan-table-input w-full"
              defaultValue={filters.q}
            />
          </div>
          <label className="grid gap-1 text-xs font-bold text-mizan-muted">
            {copy.category}
            <select
              name="category"
              className="mizan-table-input min-w-32"
              key={filters.category}
              defaultValue={filters.category ?? ""}
            >
              <option value="">{locale === "az" ? "Hamısı" : "All"}</option>
              {result?.filters?.categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-mizan-muted">
            {copy.purity}
            <select
              name="purity"
              className="mizan-table-input min-w-24"
              key={filters.purity}
              defaultValue={filters.purity ?? ""}
            >
              <option value="">{locale === "az" ? "Hamısı" : "All"}</option>
              {result?.filters?.purities.map((purity) => (
                <option key={purity}>{purity}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-mizan-muted">
            {saleCopy[locale].status}
            <select
              key={filters.status}
              name="status"
              defaultValue={filters.status ?? ""}
              className="mizan-table-input min-w-36"
            >
              <option value="">{copy.all}</option>
              <option value="IN_STOCK">{copy.IN_STOCK}</option>
              <option value="SOLD">{copy.SOLD}</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">
            {copy.find}
          </Button>
          <Link href={home} className={actionClass + " mizan-table-action"}>
            {copy.reset}
          </Link>
        </form>
      </Surface>
      <Surface className="min-w-0 px-3 sm:px-4">
        {!result ? (
          <p role="alert">{copy.unavailable}</p>
        ) : !result.items.length ? (
          <p>{copy.empty}</p>
        ) : (
          <div
            role="region"
            aria-label={copy.title}
            tabIndex={0}
            className="overflow-x-auto"
          >
            <table className="mizan-record-table min-w-145">
              <thead>
                <tr>
                  {[
                    copy.code,
                    copy.name,
                    copy.category,
                    copy.purity,
                    saleCopy[locale].weight,
                    saleCopy[locale].status,
                    saleCopy[locale].view,
                  ].map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">{item.code}</th>
                    <td>
                      <Link
                        className="flex items-center gap-2.5 font-bold text-mizan-ink no-underline hover:underline"
                        href={productHref(
                          "/products/" + encodeURIComponent(item.id),
                          scope,
                        )}
                      >
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mizan-selected text-mizan-accent">
                          <Package size={18} aria-hidden />
                        </span>
                        <span>
                          {item.name}
                          <span className="sr-only"> · {item.code}</span>
                        </span>
                      </Link>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.purity}</td>
                    <td>
                      {locale === "az"
                        ? item.weight.replace(".", ",") + " q"
                        : item.weight + " g"}
                    </td>
                    <td>
                      <StatusBadge>{copy[item.status]}</StatusBadge>
                    </td>
                    <td>
                      <Link
                        href={productHref(
                          "/products/" + encodeURIComponent(item.id),
                          scope,
                        )}
                        className={actionClass + " mizan-table-action"}
                      >
                        {saleCopy[locale].view}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
      {result?.nextCursor && (
        <Link
          className={actionClass}
          href={productHref("/products", scope, {
            q: filters.q,
            status: filters.status,
            category: filters.category,
            purity: filters.purity,
            after: result.nextCursor,
          })}
        >
          {copy.next}
        </Link>
      )}
    </section>
  );
}
