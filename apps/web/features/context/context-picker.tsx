import type { StoreContext } from "@mizan/contracts";
import { Store } from "lucide-react";
import { actionClass } from "../../components/ui/button";
import { messages, type Locale } from "../language/messages";

export function chooseContext(
  contexts: StoreContext[],
  organizationId?: string,
  storeId?: string,
) {
  if (organizationId !== undefined || storeId !== undefined) {
    return contexts.find(
      (context) =>
        context.organizationId === organizationId &&
        context.storeId === storeId,
    );
  }
  return contexts.length === 1 ? contexts[0] : undefined;
}

export function ContextPicker({
  contexts,
  selected,
  locale = "az",
}: {
  contexts: StoreContext[];
  selected?: StoreContext;
  locale?: Locale;
}) {
  if (contexts.length <= 1) return null;
  return (
    <nav aria-label={messages[locale].selectStore}>
      <h2 className="m-0 mb-3 text-lg">{messages[locale].selectStore}</h2>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {contexts.map(
          ({ organizationId, organizationName, storeId, storeName }) => (
            <li key={`${organizationId}:${storeId}`}>
              <a
                className={
                  actionClass +
                  " mizan-table-action w-full justify-start aria-[current=page]:bg-mizan-selected"
                }
                aria-current={
                  selected?.organizationId === organizationId &&
                  selected.storeId === storeId
                    ? "page"
                    : undefined
                }
                href={`/workspace?${new URLSearchParams({ organizationId, storeId })}`}
              >
                <Store size={18} aria-hidden className="shrink-0" />
                <span className="min-w-0 wrap-anywhere">
                  <strong className="block">{storeName}</strong>
                  <span className="block text-xs text-mizan-muted">
                    {organizationName}
                  </span>
                </span>
              </a>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
