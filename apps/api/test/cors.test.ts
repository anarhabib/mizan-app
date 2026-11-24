import { expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const webOrigin = "https://misqal-staging.example";

test("allows sale preflight only from the configured web origin", async () => {
  const app = await buildApp({ webOrigin });
  const preflight = {
    method: "OPTIONS" as const,
    url: "/api/v1/organizations/org/stores/store/sales",
    headers: {
      origin: webOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers":
        "authorization, content-type, idempotency-key, sale-confirmation",
    },
  };
  try {
    const allowed = await app.inject(preflight);
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(webOrigin);
    expect(allowed.headers["access-control-allow-methods"]).toContain("POST");
    expect(allowed.headers["access-control-allow-headers"]).toBe(
      "Authorization, Content-Type, Idempotency-Key, Sale-Confirmation",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBeUndefined();

    const denied = await app.inject({
      ...preflight,
      headers: { ...preflight.headers, origin: `${webOrigin}.other.example` },
    });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();

    const protectedResponse = await app.inject({
      url: "/api/v1/me/profile",
      headers: { origin: webOrigin },
    });
    expect(protectedResponse.statusCode).toBe(503);
    expect(protectedResponse.headers["access-control-allow-origin"]).toBe(
      webOrigin,
    );
  } finally {
    await app.close();
  }
});

test("rejects a wildcard origin", async () => {
  await expect(buildApp({ webOrigin: "*" })).rejects.toThrow(
    "MIZAN_WEB_ORIGIN",
  );
});
