"use client";

import { useState, type FormEvent } from "react";
import type { ProductList, ProductListItem } from "@mizan/contracts";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
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
  onSelect,
}: {
  locale: Locale;
  scope: ProductScope;
  onSelect: (product: ProductListItem) => void;
}) {
  const copy = productCopy[locale];
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [result, setResult] = useState<ProductList>();
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
      <form onSubmit={onSubmit} className="grid gap-2">
        <Field
          id="sale-product-search"
          label={saleCopy[locale].search}
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? copy.loading : copy.find}
        </Button>
      </form>
      {failed && <p role="alert">{copy.unavailable}</p>}
      {result && (
        <div className="grid gap-2" aria-live="polite">
          {result.items.length === 0 && <p>{copy.empty}</p>}
          {result.items.map((product) => (
            <Button
              key={product.id}
              variant="secondary"
              className="justify-start text-left"
              onClick={() => {
                onSelect(product);
                setResult(undefined);
              }}
            >
              <ProductIdentity locale={locale} product={product} />
            </Button>
          ))}
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
