import type { FastifyInstance } from "fastify";
import { calcularAhorro, compararVersiones } from "@certia/core";
import { CalcularSchema } from "@certia/shared";
import { ErrorHttp, usuarioDe, type Servicios } from "../contexto.js";

export async function rutasFichas(app: FastifyInstance, { catalogo }: Servicios) {
  app.addHook("preHandler", async (req) => void usuarioDe(req));

  /** Catalog summary. */
  app.get("/", async () =>
    catalogo.todas().map((f) => ({
      codigo: f.codigo,
      version: f.version,
      nombre: f.nombre,
      vigencia: f.vigencia,
    })),
  );

  /** Full definition of a version (used by the frontend to build forms). */
  app.get<{ Params: { codigo: string; version: string } }>("/:codigo/:version", async (req) => {
    const ficha = catalogo.obtener(req.params.codigo, Number(req.params.version));
    if (!ficha) throw new ErrorHttp(404, "Ficha no encontrada");
    return ficha;
  });

  /** Calculates savings without persisting anything (F-03). */
  app.post<{ Params: { codigo: string; version: string } }>("/:codigo/:version/calcular", async (req) => {
    const ficha = catalogo.obtener(req.params.codigo, Number(req.params.version));
    if (!ficha) throw new ErrorHttp(404, "Ficha no encontrada");
    const { datos } = CalcularSchema.parse(req.body);
    return calcularAhorro(ficha, datos);
  });

  /** Compares every version of a ficha using the same data (F-07). */
  app.post<{ Params: { codigo: string } }>("/:codigo/comparar", async (req) => {
    const versiones = catalogo.versiones(req.params.codigo);
    if (versiones.length === 0) throw new ErrorHttp(404, "Ficha no encontrada");
    const { datos } = CalcularSchema.parse(req.body);
    return compararVersiones(versiones, datos);
  });
}
