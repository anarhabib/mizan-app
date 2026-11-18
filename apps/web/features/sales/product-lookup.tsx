"use client";

import { useState, type FormEvent } from "react";
import type { ProductList, ProductListItem } from "@mizan/contracts";
import { Button } from "../../components/ui/button";
import type { Locale } from "../language/messages";
import { productCopy, type ProductScope } from "../products/product-copy";
import { findSaleProducts } from "./sale-actions";
import { saleCopy } from "./sale-copy";

export function ProductIdentity({
  locale,
  product,
  showStatus = true,
}: {
  locale: Locale;
  product: ProductListItem;
  showStatus?: boolean;
}) {
  const copy = productCopy[locale];
  return (
    <div className="grid gap-1 wrap-break-word">
      <strong>
        {product.name} · {product.code}
      </strong>
      <span>
        {product.purity} {copy.purity.toLowerCase()} ·{" "}
        {locale === "az"
          ? product.weight.replace(".", ",") + " q"
          : product.weight + " g"}{" "}
        {showStatus && " · " + copy[product.status]}
      </span>
    </div>
  );
}

export function ProductLookup({
  locale,
  scope,
  initial,
  onSelect,
}: {
  locale: Locale;
  scope: ProductScope;
  initial?: ProductList;
  onSelect: (product: ProductListItem) => void;
}) {
  const copy = productCopy[locale];
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [result, setResult] = useState<ProductList | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function search(q: string, after?: string) {
    setBusy(true);
    setFailed(false);
    try {
      const response = await findSaleProducts(scope, q, after);
      if (!response.data) throw new Error();
      setResult(response.data);
      setSearched(q);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) void search(query.trim());
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-xl tracking-tight">
          {saleCopy[locale].addProduct}
        </h2>
        <span className="rounded-full bg-mizan-selected px-2 py-1 text-xs font-bold text-mizan-muted">
          {saleCopy[locale].inStock}
        </span>
      </div>
      <form
        onSubmit={onSubmit}
        className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-2"
      >
        <input
          id="sale-product-search"
          aria-label={saleCopy[locale].search}
          placeholder={copy.search}
          className="mizan-table-input w-full"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          className="mizan-table-action"
          disabled={busy}
        >
          {busy ? copy.loading : copy.find}
        </Button>
      </form>
      {failed && <p role="alert">{copy.unavailable}</p>}
      {result && (
        <div className="grid gap-2" aria-live="polite">
          {result.items.length === 0 && <p>{copy.empty}</p>}
          {!!result.items.length && (
            <div
              role="region"
              aria-label={saleCopy[locale].inStock}
              tabIndex={0}
              className="max-h-72 overflow-auto sm:max-h-129"
            >
              <table className="mizan-record-table mizan-stock-table">
                <thead className="sticky top-0">
                  <tr>
                    {[
                      copy.code,
                      copy.name,
                      saleCopy[locale].weight,
                      saleCopy[locale].addProduct,
                    ].map((label, index) => (
                      <th
                        key={label}
                        scope="col"
                        className={
                          index === 0 ? "hidden sm:table-cell" : undefined
                        }
                      >
                        <span className={index === 3 ? "sr-only" : undefined}>
                          {label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((product) => (
                    <tr key={product.id}>
                      <td className="hidden sm:table-cell">{product.code}</td>
                      <th scope="row">
                        <strong className="block">{product.name}</strong>
                        <small>
                          <span className="sm:hidden">{product.code} · </span>
                          {product.purity} {copy.purity.toLowerCase()}
                        </small>
                      </th>
                      <td className="whitespace-nowrap">
                        {product.weight.replace(
                          ".",
                          locale === "az" ? "," : ".",
                        )}{" "}
                        {locale === "az" ? "q" : "g"}
                      </td>
                      <td>
                        <Button
                          key={product.id}
                          variant="secondary"
                          aria-label={
                            saleCopy[locale].addProduct +
                            " · " +
                            product.name +
                            " · " +
                            product.code
                          }
                          className="mizan-table-action px-2 whitespace-nowrap sm:px-3.5"
                          onClick={() => onSelect(product)}
                        >
                          {locale === "az" ? "Əlavə et" : "Add"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.nextCursor && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void search(searched, result.nextCursor)}
            >
              {copy.next}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
