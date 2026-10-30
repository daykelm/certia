import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { userRoles, users } from "@certia/db";
import type { Role } from "@certia/shared";
import type { Services } from "./context.js";

/**
 * Authentication.
 *
 * TODO(F-01): Google sign-in (OIDC) restricted to AUTH_ALLOWED_DOMAIN, with a cookie session.
 * Until then, in development every request is identified as DEV_USER_EMAIL.
 * In production, with no login implemented yet, the API answers 401.
 */
export function registerAuth(app: FastifyInstance, { db, config }: Services) {
  app.addHook("onRequest", async (req) => {
    if (!req.url.startsWith("/api/") || req.url.startsWith("/api/health")) return;
    if (!config.devUserEmail) return; // no user: protected routes will answer 401

    const [u] = await db.select().from(users).where(eq(users.email, config.devUserEmail));
    if (!u || !u.active) return;
    const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, u.id));
    req.currentUser = {
      id: u.id,
      organizationId: u.organizationId,
      email: u.email,
      roles: roles.map((r) => r.role as Role),
    };
  });
}
