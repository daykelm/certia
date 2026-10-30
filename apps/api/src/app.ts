import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import { registerAuth } from "./auth.js";
import { HttpError, type Services } from "./context.js";
import { dashboardRoutes } from "./routes/dashboards.js";
import { expedienteRoutes } from "./routes/expedientes.js";
import { fichaRoutes } from "./routes/fichas.js";

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
        error: "Datos no válidos",
        details: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: error.message, details: error.details });
    }
    req.log.error(error);
    return reply.code(500).send({ error: "Error interno" });
  });

  app.get("/api/health", async () => {
    await services.db.execute(sql`select 1`);
    return { ok: true, fichas: services.catalog.all().length, publicUrl: config.publicUrl };
  });

  registerAuth(app, services);
  await app.register((a) => fichaRoutes(a, services), { prefix: "/api/fichas" });
  await app.register((a) => expedienteRoutes(a, services), { prefix: "/api/expedientes" });
  await app.register((a) => dashboardRoutes(a, services), { prefix: "/api/dashboards" });

  if (config.webDir && existsSync(config.webDir)) {
    await app.register(fastifyStatic, { root: config.webDir });
    // Frontend (SPA) routes: any non-API path returns index.html.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "No encontrado" });
      return reply.sendFile("index.html");
    });
  }

  return app;
}
