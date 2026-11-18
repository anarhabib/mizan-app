import { redirect } from "next/navigation";
import type { StoreContext } from "@mizan/contracts";
import Link from "next/link";
import { Package, TrendingUp } from "lucide-react";
import { PageHeading } from "../../../components/ui/page-heading";
import { Surface } from "../../../components/ui/surface";
import { actionClass } from "../../../components/ui/button";
import {
  productCopy,
  productHref,
} from "../../../features/products/product-copy";
import { saleCopy } from "../../../features/sales/sale-copy";
import { requestContexts } from "../../../features/auth/session";
import {
  chooseContext,
  ContextPicker,
} from "../../../features/context/context-picker";
import { currentLocale } from "../../../features/language/preference";
import { messages } from "../../../features/language/messages";

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string; storeId?: string }>;
}) {
  const [{ organizationId, storeId }, result, locale] = await Promise.all([
    searchParams,
    requestContexts(),
    currentLocale(),
  ]);
  const copy = messages[locale];
  if (result.status === 401) redirect("/sign-in");
  if (result.status !== 200)
    return (
      <section className="grid gap-4">
        <PageHeading title={copy.store} />
        <Surface className="grid gap-3 p-4">
          <p role="alert" className="m-0">
            {copy.storeUnavailable}
          </p>
          <Link
            className={actionClass + " mizan-table-action w-fit"}
            href="/workspace"
          >
            {copy.retry}
          </Link>
        </Surface>
      </section>
    );
  const contexts = result.data as StoreContext[];
  if (!contexts.length) redirect("/register");
  const selected = chooseContext(contexts, organizationId, storeId);
  return (
    <section className="grid gap-4">
      <PageHeading
        title={selected?.storeName ?? copy.store}
        description={
          selected &&
          `${selected.organizationName} · ${selected.role === "OWNER" ? copy.owner : copy.salesperson}`
        }
        actions={
          selected && (
            <Link
              className={actionClass + " mizan-page-action"}
              href={productHref("/sales/new", selected)}
            >
              <TrendingUp aria-hidden size={18} />
              {saleCopy[locale].title}
            </Link>
          )
        }
      />
      {!selected && (organizationId || storeId) && (
        <p role="alert">{copy.accessDenied}</p>
      )}
      {!selected && contexts.length === 1 && (
        <a href="/workspace">{copy.openStore}</a>
      )}
      {contexts.length > 1 && (
        <Surface className="p-4 sm:p-5">
          <ContextPicker
            contexts={contexts}
            selected={selected}
            locale={locale}
          />
        </Surface>
      )}
      {selected && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              href: "/products",
              label: productCopy[locale].title,
              Icon: Package,
            },
            {
              href: "/sales",
              label: saleCopy[locale].history,
              Icon: TrendingUp,
            },
          ].map(({ href, label, Icon }) => (
            <Surface key={href} className="p-4 sm:p-5">
              <Link
                className={
                  actionClass + " mizan-table-action w-full justify-start"
                }
                href={productHref(href, selected)}
              >
                <Icon size={18} aria-hidden />
                {label}
              </Link>
            </Surface>
          ))}
        </div>
      )}
    </section>
  );
}
