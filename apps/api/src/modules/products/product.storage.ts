import { AccessError } from "../access/access.errors.js";
import { uuidPattern, type AccessContext } from "../access/access.service.js";

export interface ProductPhotoStorage {
  signUpload(key: string): Promise<string>;
  inspect(key: string): Promise<{ contentType: string; size: number } | null>;
  signDownload(key: string): Promise<string>;
  signDownloads(keys: string[]): Promise<Map<string, string>>;
}

type PhotoScope = Pick<AccessContext, "organizationId" | "storeId">;

export function photoDirectory(
  { organizationId, storeId }: PhotoScope,
  id: string,
) {
  return [organizationId, storeId, id.toLowerCase(), "photo", ""].join("/");
}

export function scopedPhotoKey(
  scope: PhotoScope,
  id: string,
  key?: string | null,
) {
  const directory = photoDirectory(scope, id);
  return key?.startsWith(directory) &&
    uuidPattern.test(key.slice(directory.length))
    ? key
    : undefined;
}

export async function pagePhotoUrls(
  storage: ProductPhotoStorage | undefined,
  scope: PhotoScope,
  products: { id: string; photoObjectKey?: string | null }[],
) {
  if (!storage) return new Map<string, string>();

  const keys = new Map<string, string>();
  for (const { id, photoObjectKey } of products) {
    const key = scopedPhotoKey(scope, id, photoObjectKey);
    if (key) keys.set(id, key);
  }
  if (keys.size) {
    try {
      const signed = await storage.signDownloads([...new Set(keys.values())]);
      const urls = new Map<string, string>();
      for (const [id, key] of keys) {
        const url = signed.get(key);
        if (url) urls.set(id, url);
      }
      return urls;
    } catch (error) {
      if (!(error instanceof AccessError && error.code === "PHOTO_UNAVAILABLE"))
        throw error;
    }
  }
  return new Map<string, string>();
}

export function createProductPhotoStorage(
  origin: string,
  serviceRoleKey: string,
): ProductPhotoStorage {
  const base = new URL("/storage/v1", origin).href;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: "Bearer " + serviceRoleKey,
    "Content-Type": "application/json",
  };
  const path = (key: string) =>
    "product-photos/" + key.split("/").map(encodeURIComponent).join("/");

  async function call(endpoint: string, body?: object) {
    try {
      return await fetch(base + endpoint, {
        method: body ? "POST" : "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new AccessError("PHOTO_UNAVAILABLE");
    }
  }

  async function readJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw new AccessError("PHOTO_UNAVAILABLE");
    }
  }

  function signedUrl(value: unknown, prefix: string) {
    if (typeof value !== "string" || !value.startsWith(prefix))
      throw new AccessError("PHOTO_UNAVAILABLE");
    return base + value;
  }

  return {
    async signUpload(key) {
      const endpoint = "/object/upload/sign/" + path(key);
      // Supabase signs an insert-only upload unless x-upsert is explicitly enabled.
      const response = await call(endpoint, {});
      if (!response.ok) throw new AccessError("PHOTO_UNAVAILABLE");
      const { url } = await readJson<{ url?: string }>(response);
      return signedUrl(url, endpoint + "?");
    },
    async inspect(key) {
      const response = await call("/object/info/" + path(key));
      const metadata = await readJson<{
        code?: string;
        content_type?: string;
        size?: number;
      }>(response);
      if (!response.ok) {
        // Local Storage can wrap NoSuchKey in HTTP 400.
        if (metadata.code === "NoSuchKey") return null;
        throw new AccessError("PHOTO_UNAVAILABLE");
      }
      return typeof metadata.content_type === "string" &&
        typeof metadata.size === "number"
        ? { contentType: metadata.content_type, size: metadata.size }
        : null;
    },
    async signDownload(key) {
      const endpoint = "/object/sign/" + path(key);
      const response = await call(endpoint, { expiresIn: 60 });
      if (!response.ok) throw new AccessError("PHOTO_UNAVAILABLE");
      const { signedURL } = await readJson<{ signedURL?: string }>(response);
      return signedUrl(signedURL, endpoint + "?");
    },
    async signDownloads(keys) {
      const requested = new Set(keys);
      const response = await call("/object/sign/product-photos", {
        paths: keys,
        expiresIn: 300,
      });
      if (!response.ok) throw new AccessError("PHOTO_UNAVAILABLE");
      const entries = await readJson<unknown>(response);
      if (!Array.isArray(entries)) throw new AccessError("PHOTO_UNAVAILABLE");
      const urls = new Map<string, string>();
      for (const entry of entries) {
        if (
          !entry ||
          typeof entry.path !== "string" ||
          !requested.has(entry.path)
        )
          continue;
        const prefix = "/object/sign/" + path(entry.path) + "?";
        if (
          typeof entry.signedURL === "string" &&
          entry.signedURL.startsWith(prefix)
        )
          urls.set(entry.path, signedUrl(entry.signedURL, prefix));
      }
      return urls;
    },
  };
}
