import type { FastifyRequest } from "fastify";
import { AccessError, type AccessFailure } from "./access.errors.js";

export function requiredKey(request: FastifyRequest, code: AccessFailure) {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
    throw new AccessError(code, "idempotencyKey");
  return key;
}
