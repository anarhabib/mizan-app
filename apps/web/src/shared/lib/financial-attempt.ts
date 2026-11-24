import { ApiError } from "./api";

const pendingAttempts = new Map<string, string>();

export async function submitFinancialAttempt<T, Result>(
  partition: string,
  body: T,
  send: (attempt: { body: T; key: string }) => Promise<Result>,
): Promise<Result> {
  const preimage = new TextEncoder().encode(JSON.stringify(body));
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", preimage));
  const payload = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const storageKey = `mizan:payable-attempt:${partition}:${payload}`;
  let saved: string | null = null;
  try {
    saved = sessionStorage.getItem(storageKey);
  } catch {
    // Keep retries available when session storage is disabled.
  }
  const key = pendingAttempts.get(storageKey) ?? saved ?? crypto.randomUUID();
  pendingAttempts.set(storageKey, key);
  try {
    sessionStorage.setItem(storageKey, key);
  } catch {
    // The in-memory key is sufficient while this page remains open.
  }

  function clearAttempt() {
    pendingAttempts.delete(storageKey);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Session storage may be unavailable.
    }
  }

  try {
    const result = await send({ body, key });
    clearAttempt();
    return result;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408
    )
      clearAttempt();
    throw error;
  }
}
