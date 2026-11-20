export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  readonly isNetwork: boolean;
  readonly confirmation?: unknown;
  constructor(
    status: number,
    code: string,
    message: string,
    field?: string,
    isNetwork = false,
    confirmation?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
    this.isNetwork = isNetwork;
    this.confirmation = confirmation;
  }
}
type Credentials = { token: string; generation: number };
type AccessToken = Credentials | string | null;
type TokenGetter = () => AccessToken | Promise<AccessToken>;
let getToken: TokenGetter = () => null;
type UnauthorizedHook = (
  error: ApiError,
  credentials: AccessToken,
  retried: boolean,
) => string | null | void | Promise<string | null | void>;
let unauthorized: UnauthorizedHook = () => {};
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
    const credentials = await getToken();
    return await send(credentials, false);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Request failed", undefined, true);
  }

  async function send(credentials: AccessToken, retried: boolean): Promise<T> {
    const token =
      typeof credentials === "object" ? credentials?.token : credentials;
    const headers = new Headers(options.headers);
    headers.delete("Authorization");
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
        false,
        payload.confirmation,
      );
      if (response.status === 401) {
        let refreshed;
        try {
          refreshed = await unauthorized(error, credentials, retried);
        } catch (refreshError) {
          if (refreshError instanceof ApiError) throw refreshError;
        }
        if (refreshed && !retried) {
          return send(
            typeof credentials === "object" && credentials
              ? { ...credentials, token: refreshed }
              : refreshed,
            true,
          );
        }
      }
      throw error;
    }
    return data as T;
  }
}
