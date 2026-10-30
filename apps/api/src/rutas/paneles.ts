import type { FastifyInstance } from "fastify";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { proponerLotes } from "@certia/core";
import { actuaciones, lotes } from "@certia/db";
import type { EstadoExpediente } from "@certia/shared";
import { z } from "zod";
import { ErrorHttp, requiereRol, usuarioDe, type Servicios } from "../contexto.js";

/** Umbrales del semáforo en días (F-13). Configurables más adelante. */
const UMBRALES = { amarillo: 7, rojo: 14 };
/** Estados finales o que dependen de terceros fuera de nuestro control directo. */
const ESTADOS_FINALES = ["emitido", "descartado"];

function dias(desde: Date) {
  return Math.floor((Date.now() - desde.getTime()) / 86_400_000);
}

function color(d: number) {
  return d >= UMBRALES.rojo ? "rojo" : d >= UMBRALES.amarillo ? "amarillo" : "verde";
}

export async function rutasPaneles(app: FastifyInstance, { db, catalogo }: Servicios) {
  app.addHook("preHandler", async (req) => void usuarioDe(req));

  /** Lo que lleva más tiempo sin moverse, primero (F-13). */
  app.get("/semaforo", async (req) => {
    const u = usuarioDe(req);
    const [exps, lts] = await Promise.all([
      db
        .select({
          id: actuaciones.id,
          referencia: actuaciones.referencia,
          estado: actuaciones.estado,
          estadoDesde: actuaciones.estadoDesde,
          responsableId: actuaciones.responsableId,
        })
        .from(actuaciones)
        .where(and(eq(actuaciones.organizationId, u.organizationId), notInArray(actuaciones.estado, ESTADOS_FINALES)))
        .orderBy(asc(actuaciones.estadoDesde))
        .limit(200),
      db
        .select({
          id: lotes.id,
          referencia: lotes.referencia,
          estado: lotes.estado,
          estadoDesde: lotes.estadoDesde,
          responsableId: lotes.responsableId,
        })
        .from(lotes)
        .where(and(eq(lotes.organizationId, u.organizationId), notInArray(lotes.estado, ["emitido"])))
        .orderBy(asc(lotes.estadoDesde))
        .limit(200),
    ]);

    return [
      ...exps.map((e) => ({ tipo: "expediente" as const, ...e })),
      ...lts.map((l) => ({ tipo: "lote" as const, ...l })),
    ]
      .map((x) => ({ ...x, dias: dias(x.estadoDesde), color: color(dias(x.estadoDesde)) }))
      .sort((a, b) => b.dias - a.dias);
  });

  /** Propuesta automática de lotes para una ficha (F-10). */
  app.get("/lotes/propuestas", { preHandler: requiereRol("verificacion", "direccion") }, async (req) => {
    const u = usuarioDe(req);
    const { ficha: codigo } = z.object({ ficha: z.string() }).parse(req.query);
    const versiones = catalogo.versiones(codigo);
    const regla = versiones.at(-1)?.agrupacion;
    if (!regla) throw new ErrorHttp(404, "Ficha no encontrada");
    if (!regla.requerida) return [];

    const filas = await db
      .select()
      .from(actuaciones)
      .where(and(eq(actuaciones.organizationId, u.organizationId), eq(actuaciones.fichaCodigo, codigo)));

    return proponerLotes(
      filas.map((a) => ({
        id: a.id,
        estado: a.estado as EstadoExpediente,
        ahorroKwh: a.ahorroKwh ?? 0,
        valores: { ...a.datos, comunidad_autonoma: a.comunidadAutonoma, anio: a.anio },
      })),
      regla,
    );
  });
}
