import "fastify";
import type {
  AccessContext,
  AuthIdentity,
} from "../modules/access/access.service.js";

declare module "fastify" {
  interface FastifyRequest {
    identity: AuthIdentity | null;
    access: AccessContext | null;
  }
}
