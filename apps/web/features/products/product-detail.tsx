import Link from "next/link";
import type { MoneyInput, ProductDetail as Product } from "@mizan/contracts";
import { money } from "../../lib/format-money";
import { StatusBadge } from "../../components/ui/status-badge";
import { actionClass } from "../../components/ui/button";
import { PageHeading } from "../../components/ui/page-heading";
import { Surface } from "../../components/ui/surface";
import type { Locale } from "../language/messages";
import { saleCopy } from "../sales/sale-copy";
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
  const showMoney = ({ amount, currency }: MoneyInput) =>
    money(locale, amount, currency);
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
      ? [[copy.acquisitionCost, showMoney(product.acquisitionCost)]]
      : []),
    ...(product.note ? [[copy.note, product.note]] : []),
    ...(product.sale
      ? [
          [
            copy.sale,
            showMoney(product.sale.total) +
              " · " +
              date.format(new Date(product.sale.createdAt)),
          ],
        ]
      : []),
  ];
  return (
    <article className="grid min-w-0 gap-4">
      <PageHeading
        title={product.name}
        description={product.code + " · " + product.category}
        actions={
          <>
            <Link
              className={actionClass + " mizan-table-action"}
              href={productHref("/products", scope)}
            >
              ← {copy.back}
            </Link>
            {product.status === "IN_STOCK" && (
              <Link
                className={actionClass + " mizan-page-action"}
                href={
                  productHref("/sales/new", scope) +
                  "&productId=" +
                  encodeURIComponent(product.id)
                }
              >
                {saleCopy[locale].title}
              </Link>
            )}
            {product.sale && (
              <Link
                className={actionClass + " mizan-table-action"}
                href={productHref(
                  "/sales/" + encodeURIComponent(product.sale.id),
                  scope,
                )}
              >
                {copy.sale}
              </Link>
            )}
          </>
        }
      />
      <div className="grid items-start gap-4 min-[1050px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Surface className="min-w-0 p-4 sm:p-5">
          <ProductPhoto locale={locale} product={product} scope={scope} />
        </Surface>
        <Surface className="grid min-w-0 gap-3 p-4 sm:p-5">
          <div>
            <StatusBadge>{copy[product.status]}</StatusBadge>
          </div>
          <dl className="m-0 grid gap-2">
            {detailRows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 border-b border-mizan-edge/40 py-2 last:border-0 sm:grid-cols-2"
              >
                <dt className="text-sm font-bold text-mizan-muted">{label}</dt>
                <dd className="m-0 wrap-anywhere">{value}</dd>
              </div>
            ))}
          </dl>
        </Surface>
      </div>
      <Surface className="grid gap-3 p-4 sm:p-5">
        <h2 className="m-0 text-xl tracking-tight">{copy.history}</h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {product.movements.map((movement) => (
            <li
              className="flex flex-wrap justify-between gap-2 border-b border-mizan-edge/40 py-2 last:border-0"
              key={movement.id}
            >
              {copy[movement.kind]} ·{" "}
              <time dateTime={movement.createdAt}>
                {date.format(new Date(movement.createdAt))}
              </time>
            </li>
          ))}
        </ul>
      </Surface>
    </article>
  );
}
