import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq } from "drizzle-orm";
import { buildChecklist, calculateSavings, canTransition, compareVersions, type Measure } from "@certia/core";
import { cases, contacts, documents, events, recordEvent } from "@certia/db";
import {
  CaseStatusSchema,
  CreateCaseSchema,
  PricePerKwhSchema,
  TransitionSchema,
  type CaseStatus,
  type DocumentStatus,
} from "@certia/shared";
import { z } from "zod";
import { currentUser, HttpError, requireRole, type Services } from "../context.js";

function newReference(measureCode: string) {
  return `${measureCode}-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function savingsIfCalculable(measure: Measure, data: Record<string, unknown>): number | null {
  const r = calculateSavings(measure, data);
  return r.ok ? r.kwh : null;
}

export async function caseRoutes(app: FastifyInstance, { db, catalog }: Services) {
  app.addHook("preHandler", async (req) => void currentUser(req));

  async function load(id: string, organizationId: string) {
    const [c] = await db
      .select()
      .from(cases)
      .where(and(eq(cases.id, id), eq(cases.organizationId, organizationId)));
    if (!c) throw new HttpError(404, "Case not found");
    const measure = catalog.get(c.measureCode, c.measureVersion);
    if (!measure) throw new HttpError(500, `Measure ${c.measureCode} v${c.measureVersion} is not in the catalog`);
    return { c, measure };
  }

  async function checklistFor(caseId: string, measure: Measure, data: Record<string, unknown>) {
    const docs = await db
      .select({ type: documents.type, status: documents.status })
      .from(documents)
      .where(eq(documents.caseId, caseId));
    return buildChecklist(
      measure,
      data,
      docs.map((d) => ({ type: d.type, status: d.status as DocumentStatus })),
    );
  }

  /** Filterable list (F-17). */
  app.get("/", async (req) => {
    const u = currentUser(req);
    const q = z
      .object({
        status: CaseStatusSchema.optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .parse(req.query);
    const filters = [eq(cases.organizationId, u.organizationId)];
    if (q.status) filters.push(eq(cases.status, q.status));
    return db
      .select({
        id: cases.id,
        reference: cases.reference,
        status: cases.status,
        statusSince: cases.statusSince,
        measureCode: cases.measureCode,
        measureVersion: cases.measureVersion,
        region: cases.region,
        year: cases.year,
        savingsKwh: cases.savingsKwh,
        contact: contacts.firstName,
      })
      .from(cases)
      .innerJoin(contacts, eq(contacts.id, cases.contactId))
      .where(and(...filters))
      .orderBy(desc(cases.createdAt))
      .limit(q.limit);
  });

  /** Creates a case together with its contact (F-04). */
  app.post("/", { preHandler: requireRole("case_manager") }, async (req, reply) => {
    const u = currentUser(req);
    const body = CreateCaseSchema.parse(req.body);
    const measure = catalog.get(body.measureCode, body.measureVersion);
    if (!measure) throw new HttpError(400, "Measure not found");

    const created = await db.transaction(async (tx) => {
      const [contact] = await tx
        .insert(contacts)
        .values({ organizationId: u.organizationId, ...body.contact })
        .returning({ id: contacts.id });
      if (!contact) throw new Error("Could not create the contact");

      const [c] = await tx
        .insert(cases)
        .values({
          organizationId: u.organizationId,
          reference: newReference(measure.code),
          contactId: contact.id,
          measureCode: measure.code,
          measureVersion: measure.version,
          region: body.region,
          year: body.year,
          data: body.data,
          savingsKwh: savingsIfCalculable(measure, body.data),
          assigneeId: u.id,
        })
        .returning();
      if (!c) throw new Error("Could not create the case");

      await recordEvent(tx, {
        organizationId: u.organizationId,
        entity: "case",
        entityId: c.id,
        type: "case.created",
        actorId: u.id,
        data: { channel: body.channel ?? null, measure: `${measure.code}@v${measure.version}` },
      });
      return c;
    });

    return reply.code(201).send(created);
  });

  /** Case detail: data, checklist, savings and history. */
  app.get<{ Params: { id: string } }>("/:id", async (req) => {
    const u = currentUser(req);
    const { c, measure } = await load(req.params.id, u.organizationId);
    const history = await db
      .select()
      .from(events)
      .where(and(eq(events.entity, "case"), eq(events.entityId, c.id)))
      .orderBy(asc(events.createdAt));
    return {
      ...c,
      checklist: await checklistFor(c.id, measure, c.data),
      calculation: calculateSavings(measure, c.data),
      history,
    };
  });

  /**
   * Compares the case's data with every version of its measure, in kWh and euros (F-07).
   * The baseline is the version the case uses today.
   */
  app.get<{ Params: { id: string } }>("/:id/comparison", async (req) => {
    const u = currentUser(req);
    const { pricePerKwh } = z.object({ pricePerKwh: PricePerKwhSchema.optional() }).parse(req.query);
    const { c } = await load(req.params.id, u.organizationId);
    return compareVersions(catalog.versions(c.measureCode), c.data, { pricePerKwh, baselineVersion: c.measureVersion });
  });

  /** Updates the measure data and recalculates the savings. */
  app.patch<{ Params: { id: string } }>("/:id/data", { preHandler: requireRole("case_manager") }, async (req) => {
    const u = currentUser(req);
    const changes = z.record(z.unknown()).parse(req.body);
    const { c, measure } = await load(req.params.id, u.organizationId);
    const data = { ...c.data, ...changes };

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(cases)
        .set({ data, savingsKwh: savingsIfCalculable(measure, data), updatedAt: new Date() })
        .where(eq(cases.id, c.id))
        .returning();
      await recordEvent(tx, {
        organizationId: u.organizationId,
        entity: "case",
        entityId: c.id,
        type: "case.data_updated",
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
      const { c, measure } = await load(req.params.id, u.organizationId);
      const from = c.status as CaseStatus;

      const checklist = await checklistFor(c.id, measure, c.data);
      const r = canTransition(from, to, {
        checklistComplete: checklist.complete,
        savingsCalculated: calculateSavings(measure, c.data).ok,
        origin: "user",
      });
      if (!r.ok) throw new HttpError(409, "The status cannot be changed", r.reasons);

      return db.transaction(async (tx) => {
        // The status condition guards against concurrent changes.
        const [updated] = await tx
          .update(cases)
          .set({ status: to, statusSince: new Date(), updatedAt: new Date() })
          .where(and(eq(cases.id, c.id), eq(cases.status, from)))
          .returning();
        if (!updated) throw new HttpError(409, "The case changed in the meantime; reload and try again");
        await recordEvent(tx, {
          organizationId: u.organizationId,
          entity: "case",
          entityId: c.id,
          type: "case.status_changed",
          actorId: u.id,
          data: { from, to, comment: comment ?? null },
        });
        return updated;
      });
    },
  );
}
