export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  readonly isNetwork: boolean;
  constructor(
    status: number,
    code: string,
    message: string,
    field?: string,
    isNetwork = false,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
    this.isNetwork = isNetwork;
  }
}
type TokenGetter = () => string | null | Promise<string | null>;
let getToken: TokenGetter = () => null;
let unauthorized: (error: ApiError) => void | Promise<void> = () => {};
export function setAccessTokenGetter(getter: TokenGetter) {
  getToken = getter;
}
export function setOnUnauthorized(hook: typeof unauthorized) {
  unauthorized = hook;
}

export async function apiRequest<T>(
  path: string,
  options: Omit<RequestInit, "body" | "credentials"> & { body?: unknown } = {},
): Promise<T> {
  try {
    const token = await getToken();
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "/api/v1"}${path}`,
      {
        ...options,
        credentials: "omit",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      },
    );
    const raw = await response.text();
    let data: unknown;
    try {
      data = raw ? JSON.parse(raw) : undefined;
    } catch {
      if (response.ok)
        throw new ApiError(
          response.status,
          "INVALID_RESPONSE",
          "Invalid API response",
        );
    }
    if (!response.ok) {
      const payload =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : {};
      const error = new ApiError(
        response.status,
        typeof payload.code === "string" ? payload.code : "HTTP_ERROR",
        typeof payload.message === "string"
          ? payload.message
          : response.statusText,
        typeof payload.field === "string" ? payload.field : undefined,
      );
      if (response.status === 401) {
        try {
          await unauthorized(error);
        } catch {
          /* Preserve the API failure. */
        }
      }
      throw error;
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Request failed", undefined, true);
  }
}
