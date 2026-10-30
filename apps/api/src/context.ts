import type { FastifyReply, FastifyRequest } from "fastify";
import type { Adapters } from "@certia/adapters";
import type { Db } from "@certia/db";
import type { Catalog } from "@certia/fichas";
import type { Role } from "@certia/shared";
import type { Config } from "./config.js";

export interface Services {
  db: Db;
  adapters: Adapters;
  catalog: Catalog;
  config: Config;
}

export interface CurrentUser {
  id: string;
  organizationId: string;
  email: string;
  roles: Role[];
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: CurrentUser;
  }
}

/** Error returned to the client; messages are user-facing (Spanish). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
  }
}

export function currentUser(req: FastifyRequest): CurrentUser {
  if (!req.currentUser) throw new HttpError(401, "No autenticado");
  return req.currentUser;
}

/** preHandler requiring at least one of the roles (F-01). Admins always pass. */
export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const u = currentUser(req);
    if (!u.roles.includes("admin") && !roles.some((r) => u.roles.includes(r))) {
      throw new HttpError(403, "No tienes permiso para esta acción");
    }
  };
}
