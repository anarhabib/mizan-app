import { enableSalespersonDisplay } from "./api";
import { parseSelection, type StoreScope } from "./selection";

const keyFor = (userId: string) => `mizan:display-mode-changed:${userId}`;
const pendingKeyFor = (userId: string) =>
  `mizan:display-mode-pending:${userId}`;

export function pendingSalespersonDisplay(userId: string) {
  try {
    return parseSelection(sessionStorage.getItem(pendingKeyFor(userId)));
  } catch {
    return null;
  }
}

export async function restrictDisplay(userId: string, scope: StoreScope) {
  const key = pendingKeyFor(userId);
  const { organizationId, storeId } = scope;
  try {
    sessionStorage.setItem(key, JSON.stringify({ organizationId, storeId }));
  } catch {
    // The request still works when browser storage is unavailable.
  }

  await enableSalespersonDisplay(scope);

  try {
    sessionStorage.removeItem(key);
  } catch {
    // A retry after reload is safe because the API operation is idempotent.
  }
  notifyDisplayModeChange(userId);
}

export function notifyDisplayModeChange(userId: string) {
  try {
    localStorage.setItem(keyFor(userId), crypto.randomUUID());
  } catch {
    // The API still persists the restriction when browser storage is unavailable.
  }
}

export function watchDisplayModeChanges(userId: string, reload: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === keyFor(userId)) reload();
  }
  function onPageHide(event: PageTransitionEvent) {
    // Keep snapshots restored by the back/forward cache concealed until reload.
    if (event.persisted) document.documentElement.style.display = "none";
  }
  function onPageShow(event: PageTransitionEvent) {
    if (event.persisted) reload();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
  };
}
