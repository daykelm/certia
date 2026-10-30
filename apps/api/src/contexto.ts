import type { FastifyReply, FastifyRequest } from "fastify";
import type { Adaptadores } from "@certia/adapters";
import type { Db } from "@certia/db";
import type { Catalogo } from "@certia/fichas";
import type { Rol } from "@certia/shared";

export interface Servicios {
  db: Db;
  adaptadores: Adaptadores;
  catalogo: Catalogo;
}

export interface Usuario {
  id: string;
  organizationId: string;
  email: string;
  roles: Rol[];
}

declare module "fastify" {
  interface FastifyRequest {
    usuario?: Usuario;
  }
}

export class ErrorHttp extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalles?: string[],
  ) {
    super(message);
  }
}

export function usuarioDe(req: FastifyRequest): Usuario {
  if (!req.usuario) throw new ErrorHttp(401, "No autenticado");
  return req.usuario;
}

/** preHandler que exige al menos uno de los roles (F-01). Los administradores pasan siempre. */
export function requiereRol(...roles: Rol[]) {
  return async (req: FastifyRequest, _rep: FastifyReply) => {
    const u = usuarioDe(req);
    if (!u.roles.includes("admin") && !roles.some((r) => u.roles.includes(r))) {
      throw new ErrorHttp(403, "No tienes permiso para esta acción");
    }
  };
}
