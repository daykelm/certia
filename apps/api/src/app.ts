import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import { registerAuth } from "./auth.js";
import { HttpError, type Services } from "./context.js";
import { dashboardRoutes } from "./routes/dashboards.js";
import { caseRoutes } from "./routes/cases.js";
import { measureRoutes } from "./routes/measures.js";

export async function buildApp(services: Services) {
  const { config } = services;
  const app = Fastify({
    logger: {
      level: config.logLevel,
      // Never log sensitive data (F-16).
      redact: ["req.headers.authorization", "req.headers.cookie", "*.dni", "*.iban"],
    },
    bodyLimit: 1024 * 1024,
    // Cloud Run terminates TLS in front of the container.
    trustProxy: true,
  });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Invalid data",
        details: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: error.message, details: error.details });
    }
    req.log.error(error);
    return reply.code(500).send({ error: "Internal error" });
  });

  app.get("/api/health", async () => {
    await services.db.execute(sql`select 1`);
    return { ok: true, measures: services.catalog.all().length, publicUrl: config.publicUrl };
  });

  registerAuth(app, services);
  await app.register((a) => measureRoutes(a, services), { prefix: "/api/measures" });
  await app.register((a) => caseRoutes(a, services), { prefix: "/api/cases" });
  await app.register((a) => dashboardRoutes(a, services), { prefix: "/api/dashboards" });

  if (config.webDir && existsSync(config.webDir)) {
    await app.register(fastifyStatic, { root: config.webDir });
    // Frontend (SPA) routes: any non-API path returns index.html.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html");
    });
  }

  return app;
}
