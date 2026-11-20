import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  ApiError,
  setAccessTokenGetter,
  setOnUnauthorized,
} from "./index";
afterEach(() => {
  vi.unstubAllGlobals();
  setAccessTokenGetter(() => null);
  setOnUnauthorized(() => {});
});
describe("API boundary", () => {
  it("attaches bearer token, JSON and no cookies", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    vi.stubGlobal("fetch", fetcher);
    setAccessTokenGetter(() => "test-token");
    await expect(
      apiRequest("/test", { method: "POST", body: { hello: "world" } }),
    ).resolves.toEqual({ ok: true });
    const options = fetcher.mock.calls[0][1];
    expect(options.headers.get("Authorization")).toBe("Bearer test-token");
    expect(options.headers.get("Content-Type")).toBe("application/json");
    expect(options.credentials).toBe("omit");
    expect(options.body).toBe('{"hello":"world"}');
  });
  it("normalizes application failures and calls 401 hook once", async () => {
    const hook = vi.fn();
    setOnUnauthorized(hook);
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          '{"code":"UNAUTHENTICATED","message":"Sign in","field":"token"}',
          { status: 401 },
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(apiRequest("/test")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
      field: "token",
      isNetwork: false,
    });
    expect(hook).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("normalizes Fastify errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            '{"statusCode":404,"error":"Not Found","message":"Missing"}',
            { status: 404 },
          ),
        ),
    );
    await expect(apiRequest("/test")).rejects.toMatchObject({
      status: 404,
      code: "HTTP_ERROR",
      message: "Missing",
    });
  });
  it("normalizes network failures without retries", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetcher);
    await expect(apiRequest("/test")).rejects.toMatchObject({
      status: 0,
      isNetwork: true,
      code: "NETWORK_ERROR",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rejects malformed JSON with ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    await expect(apiRequest("/test")).rejects.toBeInstanceOf(ApiError);
  });
  it("accepts empty 204 responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(apiRequest("/test")).resolves.toBeUndefined();
  });
});
