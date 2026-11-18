import Link from "next/link";
import type { ProductList as Inventory } from "@mizan/contracts";
import { Button, actionClass } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { StatusBadge } from "../../components/ui/status-badge";
import type { Locale } from "../language/messages";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{copy.title}</h1>
        <Link
          className={actionClass + " bg-mizan-selected"}
          href={productHref("/products/new", scope)}
        >
          {copy.add}
        </Link>
      </div>
      <form action="/products" className="flex flex-wrap items-end gap-2">
        <input
          type="hidden"
          name="organizationId"
          value={scope.organizationId}
        />
        <input type="hidden" name="storeId" value={scope.storeId} />
        <Field
          key={filters.q}
          id="q"
          name="q"
          type="search"
          maxLength={160}
          label={copy.search}
          defaultValue={filters.q}
        />
        <select
          key={filters.status}
          name="status"
          aria-label={copy.all}
          defaultValue={filters.status ?? ""}
          className="min-h-11 rounded-xl border border-mizan-edge bg-mizan-field px-3"
        >
          <option value="">{copy.all}</option>
          <option value="IN_STOCK">{copy.IN_STOCK}</option>
          <option value="SOLD">{copy.SOLD}</option>
        </select>
        <Button type="submit">{copy.find}</Button>
        <Link href={home} className={actionClass}>
          {copy.reset}
        </Link>
      </form>
      {!result ? (
        <p role="alert">{copy.unavailable}</p>
      ) : !result.items.length ? (
        <p>{copy.empty}</p>
      ) : (
        <ul className="grid gap-2">
          {result.items.map((item) => (
            <li key={item.id}>
              <Link
                href={productHref(
                  "/products/" + encodeURIComponent(item.id),
                  scope,
                )}
                className={
                  actionClass +
                  " flex flex-wrap justify-between gap-3 rounded-xl border border-mizan-edge bg-mizan-field p-3"
                }
              >
                <span className="min-w-0 wrap-break-word">
                  <strong>{item.name}</strong> · {item.code}
                </span>
                <span>
                  {item.purity} ·{" "}
                  {locale === "az"
                    ? item.weight.replace(".", ",") + " q"
                    : item.weight + " g"}
                </span>
                <StatusBadge>{copy[item.status]}</StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {result?.nextCursor && (
        <Link
          className={actionClass}
          href={productHref("/products", scope, {
            q: filters.q,
            status: filters.status,
            after: result.nextCursor,
          })}
        >
          {copy.next}
        </Link>
      )}
    </section>
  );
}
