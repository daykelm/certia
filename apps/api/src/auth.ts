import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { userRoles, users } from "@certia/db";
import type { Rol } from "@certia/shared";
import type { Servicios } from "./contexto.js";

/**
 * Authentication.
 *
 * TODO(F-01): Google sign-in (OIDC) restricted to AUTH_ALLOWED_DOMAIN, with a cookie session.
 * Until then, in development every request is identified as DEV_USER_EMAIL.
 * In production, with no login implemented yet, the API answers 401.
 */
export function registrarAuth(app: FastifyInstance, { db }: Servicios) {
  const emailDev = process.env.NODE_ENV !== "production" ? process.env.DEV_USER_EMAIL : undefined;

  app.addHook("onRequest", async (req) => {
    if (!req.url.startsWith("/api/") || req.url.startsWith("/api/salud")) return;
    if (!emailDev) return; // no user: protected routes will answer 401

    const [u] = await db.select().from(users).where(eq(users.email, emailDev));
    if (!u || !u.activo) return;
    const roles = await db.select({ rol: userRoles.rol }).from(userRoles).where(eq(userRoles.userId, u.id));
    req.usuario = {
      id: u.id,
      organizationId: u.organizationId,
      email: u.email,
      roles: roles.map((r) => r.rol as Rol),
    };
  });
}
