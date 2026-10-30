import type { FastifyInstance } from "fastify";
import { calcularAhorro, compararVersiones } from "@certia/core";
import { CalcularSchema } from "@certia/shared";
import { ErrorHttp, usuarioDe, type Servicios } from "../contexto.js";

export async function rutasFichas(app: FastifyInstance, { catalogo }: Servicios) {
  app.addHook("preHandler", async (req) => void usuarioDe(req));

  /** Catálogo resumido. */
  app.get("/", async () =>
    catalogo.todas().map((f) => ({
      codigo: f.codigo,
      version: f.version,
      nombre: f.nombre,
      vigencia: f.vigencia,
    })),
  );

  /** Definición completa de una versión (para generar formularios en el frontend). */
  app.get<{ Params: { codigo: string; version: string } }>("/:codigo/:version", async (req) => {
    const ficha = catalogo.obtener(req.params.codigo, Number(req.params.version));
    if (!ficha) throw new ErrorHttp(404, "Ficha no encontrada");
    return ficha;
  });

  /** Calcula el ahorro sin guardar nada (F-03). */
  app.post<{ Params: { codigo: string; version: string } }>("/:codigo/:version/calcular", async (req) => {
    const ficha = catalogo.obtener(req.params.codigo, Number(req.params.version));
    if (!ficha) throw new ErrorHttp(404, "Ficha no encontrada");
    const { datos } = CalcularSchema.parse(req.body);
    return calcularAhorro(ficha, datos);
  });

  /** Compara todas las versiones de una ficha con los mismos datos (F-07). */
  app.post<{ Params: { codigo: string } }>("/:codigo/comparar", async (req) => {
    const versiones = catalogo.versiones(req.params.codigo);
    if (versiones.length === 0) throw new ErrorHttp(404, "Ficha no encontrada");
    const { datos } = CalcularSchema.parse(req.body);
    return compararVersiones(versiones, datos);
  });
}
