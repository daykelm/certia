import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq } from "drizzle-orm";
import { calcularAhorro, generarChecklist, puedeTransicionar, type Ficha } from "@certia/core";
import { actuaciones, contacts, documents, events, registrarEvento } from "@certia/db";
import {
  CrearActuacionSchema,
  EstadoExpedienteSchema,
  TransicionSchema,
  type EstadoDocumento,
  type EstadoExpediente,
} from "@certia/shared";
import { z } from "zod";
import { ErrorHttp, requiereRol, usuarioDe, type Servicios } from "../contexto.js";

function nuevaReferencia(codigo: string) {
  const anio = new Date().getFullYear();
  return `${codigo}-${anio}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function ahorroSiCalculable(ficha: Ficha, datos: Record<string, unknown>): number | null {
  const r = calcularAhorro(ficha, datos);
  return r.ok ? r.kwh : null;
}

export async function rutasActuaciones(app: FastifyInstance, { db, catalogo }: Servicios) {
  app.addHook("preHandler", async (req) => void usuarioDe(req));

  async function cargar(id: string, organizationId: string) {
    const [a] = await db
      .select()
      .from(actuaciones)
      .where(and(eq(actuaciones.id, id), eq(actuaciones.organizationId, organizationId)));
    if (!a) throw new ErrorHttp(404, "Expediente no encontrado");
    const ficha = catalogo.obtener(a.fichaCodigo, a.fichaVersion);
    if (!ficha) throw new ErrorHttp(500, `La ficha ${a.fichaCodigo} v${a.fichaVersion} no está en el catálogo`);
    return { a, ficha };
  }

  async function checklistDe(actuacionId: string, ficha: Ficha, datos: Record<string, unknown>) {
    const docs = await db
      .select({ tipo: documents.tipo, estado: documents.estado })
      .from(documents)
      .where(eq(documents.actuacionId, actuacionId));
    return generarChecklist(
      ficha,
      datos,
      docs.map((d) => ({ tipo: d.tipo, estado: d.estado as EstadoDocumento })),
    );
  }

  /** Filterable list (F-17). */
  app.get("/", async (req) => {
    const u = usuarioDe(req);
    const q = z
      .object({ estado: EstadoExpedienteSchema.optional(), limite: z.coerce.number().int().min(1).max(500).default(100) })
      .parse(req.query);
    const filtros = [eq(actuaciones.organizationId, u.organizationId)];
    if (q.estado) filtros.push(eq(actuaciones.estado, q.estado));
    return db
      .select({
        id: actuaciones.id,
        referencia: actuaciones.referencia,
        estado: actuaciones.estado,
        estadoDesde: actuaciones.estadoDesde,
        fichaCodigo: actuaciones.fichaCodigo,
        fichaVersion: actuaciones.fichaVersion,
        comunidadAutonoma: actuaciones.comunidadAutonoma,
        anio: actuaciones.anio,
        ahorroKwh: actuaciones.ahorroKwh,
        contacto: contacts.nombre,
      })
      .from(actuaciones)
      .innerJoin(contacts, eq(contacts.id, actuaciones.contactId))
      .where(and(...filtros))
      .orderBy(desc(actuaciones.createdAt))
      .limit(q.limite);
  });

  /** Creates an expediente together with its contact (F-04). */
  app.post("/", { preHandler: requiereRol("gestion") }, async (req, rep) => {
    const u = usuarioDe(req);
    const body = CrearActuacionSchema.parse(req.body);
    const ficha = catalogo.obtener(body.fichaCodigo, body.fichaVersion);
    if (!ficha) throw new ErrorHttp(400, "Ficha no encontrada");

    const creada = await db.transaction(async (tx) => {
      const [contacto] = await tx
        .insert(contacts)
        .values({ organizationId: u.organizationId, ...body.contacto })
        .returning({ id: contacts.id });
      if (!contacto) throw new Error("No se pudo crear el contacto");

      const [a] = await tx
        .insert(actuaciones)
        .values({
          organizationId: u.organizationId,
          referencia: nuevaReferencia(ficha.codigo),
          contactId: contacto.id,
          fichaCodigo: ficha.codigo,
          fichaVersion: ficha.version,
          comunidadAutonoma: body.comunidadAutonoma,
          anio: body.anio,
          datos: body.datos,
          ahorroKwh: ahorroSiCalculable(ficha, body.datos),
          responsableId: u.id,
        })
        .returning();
      if (!a) throw new Error("No se pudo crear el expediente");

      await registrarEvento(tx, {
        organizationId: u.organizationId,
        entidad: "actuacion",
        entidadId: a.id,
        tipo: "actuacion.creada",
        actorId: u.id,
        datos: { canal: body.canal ?? null, ficha: `${ficha.codigo}@v${ficha.version}` },
      });
      return a;
    });

    return rep.code(201).send(creada);
  });

  /** Expediente detail: data, checklist, savings and history. */
  app.get<{ Params: { id: string } }>("/:id", async (req) => {
    const u = usuarioDe(req);
    const { a, ficha } = await cargar(req.params.id, u.organizationId);
    const historial = await db
      .select()
      .from(events)
      .where(and(eq(events.entidad, "actuacion"), eq(events.entidadId, a.id)))
      .orderBy(asc(events.createdAt));
    return {
      ...a,
      checklist: await checklistDe(a.id, ficha, a.datos),
      calculo: calcularAhorro(ficha, a.datos),
      historial,
    };
  });

  /** Updates the ficha data and recalculates the savings. */
  app.patch<{ Params: { id: string } }>("/:id/datos", { preHandler: requiereRol("gestion") }, async (req) => {
    const u = usuarioDe(req);
    const cambios = z.record(z.unknown()).parse(req.body);
    const { a, ficha } = await cargar(req.params.id, u.organizationId);
    const datos = { ...a.datos, ...cambios };

    return db.transaction(async (tx) => {
      const [actualizada] = await tx
        .update(actuaciones)
        .set({ datos, ahorroKwh: ahorroSiCalculable(ficha, datos), updatedAt: new Date() })
        .where(eq(actuaciones.id, a.id))
        .returning();
      await registrarEvento(tx, {
        organizationId: u.organizationId,
        entidad: "actuacion",
        entidadId: a.id,
        tipo: "actuacion.datos_actualizados",
        actorId: u.id,
        datos: { campos: Object.keys(cambios) },
      });
      return actualizada;
    });
  });

  /** Manual state change, validated by the state machine. */
  app.post<{ Params: { id: string } }>(
    "/:id/transiciones",
    { preHandler: requiereRol("gestion", "verificacion") },
    async (req) => {
      const u = usuarioDe(req);
      const { destino, comentario } = TransicionSchema.parse(req.body);
      const { a, ficha } = await cargar(req.params.id, u.organizationId);
      const desde = a.estado as EstadoExpediente;

      const checklist = await checklistDe(a.id, ficha, a.datos);
      const r = puedeTransicionar(desde, destino, {
        checklistCompleta: checklist.completa,
        ahorroCalculado: calcularAhorro(ficha, a.datos).ok,
        origen: "usuario",
      });
      if (!r.ok) throw new ErrorHttp(409, "No se puede cambiar el estado", r.motivos);

      return db.transaction(async (tx) => {
        const [actualizada] = await tx
          .update(actuaciones)
          .set({ estado: destino, estadoDesde: new Date(), updatedAt: new Date() })
          .where(and(eq(actuaciones.id, a.id), eq(actuaciones.estado, desde)))
          .returning();
        if (!actualizada) throw new ErrorHttp(409, "El expediente cambió mientras tanto; recarga e inténtalo de nuevo");
        await registrarEvento(tx, {
          organizationId: u.organizationId,
          entidad: "actuacion",
          entidadId: a.id,
          tipo: "actuacion.estado_cambiado",
          actorId: u.id,
          datos: { desde, hasta: destino, comentario: comentario ?? null },
        });
        return actualizada;
      });
    },
  );
}
