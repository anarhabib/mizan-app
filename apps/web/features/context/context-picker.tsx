import type { StoreContext } from "@mizan/contracts";
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
      <h2>{messages[locale].selectStore}</h2>
      <ul>
        {contexts.map(
          ({ organizationId, organizationName, storeId, storeName }) => (
            <li key={`${organizationId}:${storeId}`}>
              <a
                aria-current={
                  selected?.organizationId === organizationId &&
                  selected.storeId === storeId
                    ? "page"
                    : undefined
                }
                href={`/workspace?${new URLSearchParams({ organizationId, storeId })}`}
              >
                {organizationName} / {storeName}
              </a>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
