import Link from "next/link";
import type { MoneyInput, ProductDetail as Product } from "@mizan/contracts";
import { StatusBadge } from "../../components/ui/status-badge";
import type { Locale } from "../language/messages";
import { productCopy, productHref, type ProductScope } from "./product-copy";
import { ProductPhoto } from "./product-photo";

export function ProductDetail({
  locale,
  scope,
  product,
}: {
  locale: Locale;
  scope: ProductScope;
  product: Product;
}) {
  const copy = productCopy[locale];
  const money = ({ amount, currency }: MoneyInput) =>
    (locale === "az" ? amount.replace(".", ",") : amount) + " " + currency;
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Baku",
  });
  const detailRows = [
    [copy.code, product.code],
    [copy.category, product.category],
    [copy.purity, String(product.purity)],
    [
      copy.weight,
      locale === "az" ? product.weight.replace(".", ",") : product.weight,
    ],
    ...(product.acquisitionCost
      ? [[copy.acquisitionCost, money(product.acquisitionCost)]]
      : []),
    ...(product.note ? [[copy.note, product.note]] : []),
    ...(product.sale
      ? [
          [
            copy.sale,
            money(product.sale.total) +
              " · " +
              date.format(new Date(product.sale.createdAt)),
          ],
        ]
      : []),
  ];
  return (
    <article className="grid max-w-4xl gap-4">
      <Link className="w-fit underline" href={productHref("/products", scope)}>
        {copy.back}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="wrap-break-word">{product.name}</h1>
        <StatusBadge>{copy[product.status]}</StatusBadge>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <ProductPhoto locale={locale} product={product} scope={scope} />
        <dl className="grid gap-3 rounded-xl border border-mizan-edge bg-mizan-field p-4">
          {detailRows.map(([label, value]) => (
            <div key={label} className="grid gap-1">
              <dt className="text-sm font-bold">{label}</dt>
              <dd className="wrap-break-word">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <section className="grid gap-2">
        <h2>{copy.history}</h2>
        <ul>
          {product.movements.map((movement) => (
            <li key={movement.id}>
              {copy[movement.kind]} ·{" "}
              <time dateTime={movement.createdAt}>
                {date.format(new Date(movement.createdAt))}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
