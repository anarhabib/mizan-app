import type { FastifyRequest } from "fastify";
import {
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  errors,
  jwtVerify,
  type JWTPayload,
} from "jose";
import { AccessError } from "../modules/access/access.errors.js";
import {
  ensureApplicationUser,
  uuidPattern,
  type AccessDatabase,
  type AuthIdentity,
} from "../modules/access/access.service.js";

const audience = "authenticated";

export type VerifyToken = (token: string) => Promise<AuthIdentity | null>;

function identityFromClaims(payload: JWTPayload): AuthIdentity {
  if (
    !payload.sub ||
    !uuidPattern.test(payload.sub) ||
    payload.role !== audience ||
    payload.is_anonymous === true
  ) {
    throw new AccessError("UNAUTHENTICATED");
  }
  return { userId: payload.sub.toLowerCase() };
}

// Legacy Supabase projects use a symmetric key that is never published in JWKS.
async function verifyLegacy(
  token: string,
  issuer: string,
  apiKey: string,
): Promise<AuthIdentity> {
  let response: Response;
  try {
    response = await fetch(`${issuer}/user`, {
      headers: { apikey: apiKey, authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new AccessError("AUTH_UNAVAILABLE");
  }
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 400
  ) {
    throw new AccessError("UNAUTHENTICATED");
  }
  if (!response.ok) throw new AccessError("AUTH_UNAVAILABLE");

  let user: { id?: string; is_anonymous?: boolean };
  try {
    user = await response.json();
    if (!user || typeof user.id !== "string") throw new Error();
  } catch {
    throw new AccessError("AUTH_UNAVAILABLE");
  }

  const payload = decodeJwt(token);
  const tokenAudiences = Array.isArray(payload.aud)
    ? payload.aud
    : [payload.aud];
  if (
    payload.iss !== issuer ||
    !tokenAudiences.includes(audience) ||
    !payload.exp ||
    payload.exp <= Date.now() / 1000 ||
    payload.sub !== user.id ||
    user.is_anonymous === true ||
    (payload.nbf !== undefined && payload.nbf > Date.now() / 1000)
  ) {
    throw new AccessError("UNAUTHENTICATED");
  }
  return identityFromClaims(payload);
}

export function createSupabaseVerifier({
  issuer,
  apiKey,
}: {
  issuer: string;
  apiKey?: string;
}): VerifyToken {
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
    timeoutDuration: 5000,
  });

  return async (token) => {
    let algorithm: string | undefined;
    try {
      algorithm = decodeProtectedHeader(token).alg;
    } catch {
      throw new AccessError("UNAUTHENTICATED");
    }

    try {
      if (algorithm === "HS256" && apiKey) {
        return await verifyLegacy(token, issuer, apiKey);
      }
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience,
        algorithms: ["ES256", "RS256"],
        requiredClaims: ["sub", "exp"],
      });
      return identityFromClaims(payload);
    } catch (error) {
      if (error instanceof AccessError) throw error;
      if (
        error instanceof errors.JOSEError &&
        [
          "ERR_JWS_INVALID",
          "ERR_JWT_INVALID",
          "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
          "ERR_JWT_CLAIM_VALIDATION_FAILED",
          "ERR_JWT_EXPIRED",
          "ERR_JWKS_NO_MATCHING_KEY",
          "ERR_JOSE_ALG_NOT_ALLOWED",
          "ERR_JOSE_NOT_SUPPORTED",
        ].includes(error.code)
      ) {
        throw new AccessError("UNAUTHENTICATED");
      }
      throw new AccessError("AUTH_UNAVAILABLE");
    }
  };
}

export function readBearerToken(request: FastifyRequest) {
  return /^Bearer ([^\s,]+)$/i.exec(request.headers.authorization ?? "")?.[1];
}

export function createVerifiedEmailLookup(issuer: string, apiKey?: string) {
  return async (bearer: string, userId: string): Promise<string | null> => {
    if (!apiKey) throw new AccessError("AUTH_UNAVAILABLE");
    try {
      const response = await fetch(`${issuer}/user`, {
        headers: { apikey: apiKey, authorization: `Bearer ${bearer}` },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new Error();
      const user = await response.json();
      return user.id === userId &&
        typeof user.email === "string" &&
        typeof user.email_confirmed_at === "string" &&
        !user.is_anonymous
        ? user.email
        : null;
    } catch {
      throw new AccessError("AUTH_UNAVAILABLE");
    }
  };
}

export function authenticate(db: AccessDatabase, verifyToken: VerifyToken) {
  return async (request: FastifyRequest) => {
    const token = readBearerToken(request);
    if (!token) throw new AccessError("UNAUTHENTICATED");
    const identity = await verifyToken(token);
    if (!identity || !uuidPattern.test(identity.userId))
      throw new AccessError("UNAUTHENTICATED");
    await ensureApplicationUser(db, identity);
    request.identity = identity;
  };
}
