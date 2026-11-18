import Link from "next/link";
import { redirect } from "next/navigation";
import { requestContexts } from "../auth/session";
import { chooseContext } from "../context/context-picker";
import { messages } from "../language/messages";
import { currentLocale } from "../language/preference";
import {
  productCopy,
  productHref,
  type ProductFilters,
  type ProductScope,
} from "./product-copy";

export type ProductSearch = Promise<Partial<ProductScope> & ProductFilters>;

export async function productPage(
  searchParams: ProductSearch,
  path = "/products",
  title?: Record<"en" | "az", string>,
) {
  const [query, locale, session] = await Promise.all([
    searchParams,
    currentLocale(),
    requestContexts(),
  ]);
  if (session.status === 401) redirect("/sign-in");
  const contexts = session.status === 200 ? session.data : [];
  const scope = chooseContext(contexts, query.organizationId, query.storeId);
  const copy = productCopy[locale];
  const fallback = (
    <section className="grid gap-4">
      <h1>{title?.[locale] ?? copy.title}</h1>
      {contexts.length ? (
        <nav aria-label={messages[locale].selectStore}>
          <h2>{messages[locale].selectStore}</h2>
          <ul className="grid gap-2">
            {contexts.map((context: NonNullable<typeof scope>) => (
              <li key={context.organizationId + ":" + context.storeId}>
                <Link className="underline" href={productHref(path, context)}>
                  {context.organizationName} / {context.storeName}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <p role="alert">{copy.unavailable}</p>
      )}
    </section>
  );
  return { scope, locale, copy, query, fallback };
}
