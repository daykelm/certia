import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import { registrarAuth } from "./auth.js";
import { ErrorHttp, type Servicios } from "./contexto.js";
import { rutasActuaciones } from "./rutas/actuaciones.js";
import { rutasFichas } from "./rutas/fichas.js";
import { rutasPaneles } from "./rutas/paneles.js";

export interface OpcionesApp {
  /** Carpeta con el frontend compilado; si existe, la API lo sirve. */
  webDir?: string;
}

export async function construirApp(servicios: Servicios, opciones: OpcionesApp = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      // Nunca registrar datos sensibles (F-16).
      redact: ["req.headers.authorization", "req.headers.cookie", "*.dni", "*.iban"],
    },
    bodyLimit: 1024 * 1024,
  });

  app.setErrorHandler((error, req, rep) => {
    if (error instanceof ZodError) {
      return rep.code(400).send({
        error: "Datos no válidos",
        detalles: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    if (error instanceof ErrorHttp) {
      return rep.code(error.status).send({ error: error.message, detalles: error.detalles });
    }
    req.log.error(error);
    return rep.code(500).send({ error: "Error interno" });
  });

  app.get("/api/salud", async () => {
    await servicios.db.execute(sql`select 1`);
    return { ok: true, fichas: servicios.catalogo.todas().length };
  });

  registrarAuth(app, servicios);
  await app.register((a) => rutasFichas(a, servicios), { prefix: "/api/fichas" });
  await app.register((a) => rutasActuaciones(a, servicios), { prefix: "/api/actuaciones" });
  await app.register((a) => rutasPaneles(a, servicios), { prefix: "/api/paneles" });

  if (opciones.webDir && existsSync(opciones.webDir)) {
    await app.register(fastifyStatic, { root: opciones.webDir });
    // Rutas del frontend (SPA): cualquier ruta que no sea de la API devuelve index.html.
    app.setNotFoundHandler((req, rep) => {
      if (req.url.startsWith("/api/")) return rep.code(404).send({ error: "No encontrado" });
      return rep.sendFile("index.html");
    });
  }

  return app;
}
