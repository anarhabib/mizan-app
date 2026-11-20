import type { StoreContext } from "@mizan/contracts";

export type StoreScope = Pick<StoreContext, "organizationId" | "storeId">;

export function sameScope(a: StoreScope, b: StoreScope) {
  return a.organizationId === b.organizationId && a.storeId === b.storeId;
}

export function resolveSelection(
  contexts: StoreContext[],
  selection: StoreScope | null,
) {
  return (
    (selection && contexts.find((item) => sameScope(item, selection))) ||
    contexts[0]
  );
}

export function parseSelection(raw: string | null): StoreScope | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoreScope> | null;
    if (
      typeof value?.organizationId === "string" &&
      value.organizationId &&
      typeof value.storeId === "string" &&
      value.storeId
    ) {
      return { organizationId: value.organizationId, storeId: value.storeId };
    }
  } catch {
    /* An invalid preference is equivalent to no preference. */
  }
  return null;
}

function storageKey(userId: string) {
  return `mizan.workspace.${userId}`;
}

export function readSelection(userId: string) {
  try {
    return parseSelection(localStorage.getItem(storageKey(userId)));
  } catch {
    return null;
  }
}

export function saveSelection(userId: string, selection: StoreScope) {
  const { organizationId, storeId } = selection;
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ organizationId, storeId }),
    );
  } catch {
    /* Selection remains usable for this session. */
  }
}
