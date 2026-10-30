import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq } from "drizzle-orm";
import { buildChecklist, calculateSavings, canTransition, type Ficha } from "@certia/core";
import { contacts, documents, events, expedientes, recordEvent } from "@certia/db";
import {
  CreateExpedienteSchema,
  ExpedienteStatusSchema,
  TransitionSchema,
  type DocumentStatus,
  type ExpedienteStatus,
} from "@certia/shared";
import { z } from "zod";
import { currentUser, HttpError, requireRole, type Services } from "../context.js";

function newReference(fichaCode: string) {
  return `${fichaCode}-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function savingsIfCalculable(ficha: Ficha, data: Record<string, unknown>): number | null {
  const r = calculateSavings(ficha, data);
  return r.ok ? r.kwh : null;
}

export async function expedienteRoutes(app: FastifyInstance, { db, catalog }: Services) {
  app.addHook("preHandler", async (req) => void currentUser(req));

  async function load(id: string, organizationId: string) {
    const [e] = await db
      .select()
      .from(expedientes)
      .where(and(eq(expedientes.id, id), eq(expedientes.organizationId, organizationId)));
    if (!e) throw new HttpError(404, "Expediente no encontrado");
    const ficha = catalog.get(e.fichaCode, e.fichaVersion);
    if (!ficha) throw new HttpError(500, `La ficha ${e.fichaCode} v${e.fichaVersion} no está en el catálogo`);
    return { e, ficha };
  }

  async function checklistFor(expedienteId: string, ficha: Ficha, data: Record<string, unknown>) {
    const docs = await db
      .select({ type: documents.type, status: documents.status })
      .from(documents)
      .where(eq(documents.expedienteId, expedienteId));
    return buildChecklist(
      ficha,
      data,
      docs.map((d) => ({ type: d.type, status: d.status as DocumentStatus })),
    );
  }

  /** Filterable list (F-17). */
  app.get("/", async (req) => {
    const u = currentUser(req);
    const q = z
      .object({
        status: ExpedienteStatusSchema.optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .parse(req.query);
    const filters = [eq(expedientes.organizationId, u.organizationId)];
    if (q.status) filters.push(eq(expedientes.status, q.status));
    return db
      .select({
        id: expedientes.id,
        reference: expedientes.reference,
        status: expedientes.status,
        statusSince: expedientes.statusSince,
        fichaCode: expedientes.fichaCode,
        fichaVersion: expedientes.fichaVersion,
        region: expedientes.region,
        year: expedientes.year,
        savingsKwh: expedientes.savingsKwh,
        contact: contacts.firstName,
      })
      .from(expedientes)
      .innerJoin(contacts, eq(contacts.id, expedientes.contactId))
      .where(and(...filters))
      .orderBy(desc(expedientes.createdAt))
      .limit(q.limit);
  });

  /** Creates an expediente together with its contact (F-04). */
  app.post("/", { preHandler: requireRole("case_manager") }, async (req, reply) => {
    const u = currentUser(req);
    const body = CreateExpedienteSchema.parse(req.body);
    const ficha = catalog.get(body.fichaCode, body.fichaVersion);
    if (!ficha) throw new HttpError(400, "Ficha no encontrada");

    const created = await db.transaction(async (tx) => {
      const [contact] = await tx
        .insert(contacts)
        .values({ organizationId: u.organizationId, ...body.contact })
        .returning({ id: contacts.id });
      if (!contact) throw new Error("Could not create the contact");

      const [e] = await tx
        .insert(expedientes)
        .values({
          organizationId: u.organizationId,
          reference: newReference(ficha.code),
          contactId: contact.id,
          fichaCode: ficha.code,
          fichaVersion: ficha.version,
          region: body.region,
          year: body.year,
          data: body.data,
          savingsKwh: savingsIfCalculable(ficha, body.data),
          assigneeId: u.id,
        })
        .returning();
      if (!e) throw new Error("Could not create the expediente");

      await recordEvent(tx, {
        organizationId: u.organizationId,
        entity: "expediente",
        entityId: e.id,
        type: "expediente.created",
        actorId: u.id,
        data: { channel: body.channel ?? null, ficha: `${ficha.code}@v${ficha.version}` },
      });
      return e;
    });

    return reply.code(201).send(created);
  });

  /** Expediente detail: data, checklist, savings and history. */
  app.get<{ Params: { id: string } }>("/:id", async (req) => {
    const u = currentUser(req);
    const { e, ficha } = await load(req.params.id, u.organizationId);
    const history = await db
      .select()
      .from(events)
      .where(and(eq(events.entity, "expediente"), eq(events.entityId, e.id)))
      .orderBy(asc(events.createdAt));
    return {
      ...e,
      checklist: await checklistFor(e.id, ficha, e.data),
      calculation: calculateSavings(ficha, e.data),
      history,
    };
  });

  /** Updates the ficha data and recalculates the savings. */
  app.patch<{ Params: { id: string } }>("/:id/data", { preHandler: requireRole("case_manager") }, async (req) => {
    const u = currentUser(req);
    const changes = z.record(z.unknown()).parse(req.body);
    const { e, ficha } = await load(req.params.id, u.organizationId);
    const data = { ...e.data, ...changes };

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(expedientes)
        .set({ data, savingsKwh: savingsIfCalculable(ficha, data), updatedAt: new Date() })
        .where(eq(expedientes.id, e.id))
        .returning();
      await recordEvent(tx, {
        organizationId: u.organizationId,
        entity: "expediente",
        entityId: e.id,
        type: "expediente.data_updated",
        actorId: u.id,
        data: { fields: Object.keys(changes) },
      });
      return updated;
    });
  });

  /** Manual status change, validated by the state machine. */
  app.post<{ Params: { id: string } }>(
    "/:id/transitions",
    { preHandler: requireRole("case_manager", "verifier") },
    async (req) => {
      const u = currentUser(req);
      const { to, comment } = TransitionSchema.parse(req.body);
      const { e, ficha } = await load(req.params.id, u.organizationId);
      const from = e.status as ExpedienteStatus;

      const checklist = await checklistFor(e.id, ficha, e.data);
      const r = canTransition(from, to, {
        checklistComplete: checklist.complete,
        savingsCalculated: calculateSavings(ficha, e.data).ok,
        origin: "user",
      });
      if (!r.ok) throw new HttpError(409, "No se puede cambiar el estado", r.reasons);

      return db.transaction(async (tx) => {
        // The status condition guards against concurrent changes.
        const [updated] = await tx
          .update(expedientes)
          .set({ status: to, statusSince: new Date(), updatedAt: new Date() })
          .where(and(eq(expedientes.id, e.id), eq(expedientes.status, from)))
          .returning();
        if (!updated) {
          throw new HttpError(409, "El expediente cambió mientras tanto; recarga e inténtalo de nuevo");
        }
        await recordEvent(tx, {
          organizationId: u.organizationId,
          entity: "expediente",
          entityId: e.id,
          type: "expediente.status_changed",
          actorId: u.id,
          data: { from, to, comment: comment ?? null },
        });
        return updated;
      });
    },
  );
}
