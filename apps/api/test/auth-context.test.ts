import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createSupabaseVerifier } from "../src/plugins/auth.js";

const userId = randomUUID();
const sessionId = randomUUID();
const pair = await generateKeyPair("ES256");
const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test", alg: "ES256" };
const legacyKey = randomBytes(32);
const publishableKey = "test-publishable-key";
let issuer: string;
const auth = createServer(async (req, res) => {
  if (req.url === "/auth/v1/user") {
    try {
      if (req.headers.apikey !== publishableKey)
        throw new Error("Wrong API key");
      const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
      if (!token) throw new Error("Missing token");
      const { payload } = await jwtVerify(token, legacyKey, {
        algorithms: ["HS256"],
        issuer,
      });
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ id: payload.sub }));
    } catch {
      res.writeHead(401).end();
    }
    return;
  }
  if (req.url !== "/auth/v1/.well-known/jwks.json") {
    res.writeHead(404).end();
    return;
  }
  res
    .writeHead(200, { "Content-Type": "application/json" })
    .end(JSON.stringify({ keys: [jwk] }));
});

beforeAll(async () => {
  await new Promise<void>((resolve) => auth.listen(0, "127.0.0.1", resolve));
  const address = auth.address();
  if (!address || typeof address === "string")
    throw new Error("Test Auth port missing");
  issuer = `http://127.0.0.1:${address.port}/auth/v1`;
});
afterAll(() => new Promise<void>((resolve) => auth.close(() => resolve())));

function token(
  overrides: {
    issuer?: string;
    audience?: string;
    expiration?: string;
    role?: string;
    sessionId?: string | null;
    anonymous?: boolean;
  } = {},
) {
  return new SignJWT({
    role: overrides.role ?? "authenticated",
    session_id:
      overrides.sessionId === undefined ? sessionId : overrides.sessionId,
    is_anonymous: overrides.anonymous ?? false,
  })
    .setProtectedHeader({ alg: "ES256", kid: "test" })
    .setIssuer(overrides.issuer ?? issuer)
    .setAudience(overrides.audience ?? "authenticated")
    .setSubject(userId)
    .setExpirationTime(overrides.expiration ?? "3m")
    .sign(pair.privateKey);
}

test("accepts a signed user token from the configured issuer", async () => {
  const verify = createSupabaseVerifier({ issuer });
  await expect(verify(await token())).resolves.toEqual({ userId, sessionId });
});

test.each([
  { issuer: "https://another-project.example/auth/v1" },
  { audience: "other" },
  { expiration: "-1m" },
  { role: "service_role" },
  { anonymous: true },
  { sessionId: null },
  { sessionId: "invalid" },
])("rejects tokens with invalid user claims %j", async (claims) => {
  const verify = createSupabaseVerifier({ issuer });
  await expect(verify(await token(claims))).rejects.toMatchObject({
    statusCode: 401,
  });
});

test("rejects a bad signature even when its claims match", async () => {
  const [header, claims, signature] = (await token()).split(".");
  const changed = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  await expect(
    createSupabaseVerifier({ issuer })(`${header}.${claims}.${changed}`),
  ).rejects.toMatchObject({ statusCode: 401 });
});

test("rejects malformed tokens", async () => {
  await expect(
    createSupabaseVerifier({ issuer })("not-a-jwt"),
  ).rejects.toMatchObject({
    statusCode: 401,
  });
});

test("asks Supabase to validate legacy tokens when a publishable key is configured", async () => {
  const sign = (key: Uint8Array) =>
    new SignJWT({ role: "authenticated", session_id: sessionId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience("authenticated")
      .setSubject(userId)
      .setExpirationTime("3m")
      .sign(key);
  const verify = createSupabaseVerifier({ issuer, apiKey: publishableKey });
  await expect(verify(await sign(legacyKey))).resolves.toEqual({
    userId,
    sessionId,
  });
  await expect(verify(await sign(randomBytes(32)))).rejects.toMatchObject({
    statusCode: 401,
  });
});
