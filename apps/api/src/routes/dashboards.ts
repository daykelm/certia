import type { FastifyInstance } from "fastify";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { proposeLotes } from "@certia/core";
import { expedientes, lotes } from "@certia/db";
import type { ExpedienteStatus } from "@certia/shared";
import { z } from "zod";
import { currentUser, HttpError, requireRole, type Services } from "../context.js";

/** Traffic-light thresholds in days (F-13). To be made configurable. */
const THRESHOLDS = { amber: 7, red: 14 };
/** Final states, excluded from the traffic light. */
const FINAL_EXPEDIENTE_STATUSES = ["issued", "discarded"];

function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function colorFor(days: number) {
  return days >= THRESHOLDS.red ? "red" : days >= THRESHOLDS.amber ? "amber" : "green";
}

export async function dashboardRoutes(app: FastifyInstance, { db, catalog }: Services) {
  app.addHook("preHandler", async (req) => void currentUser(req));

  /** Whatever has been idle the longest comes first (F-13). */
  app.get("/traffic-light", async (req) => {
    const u = currentUser(req);
    const [stalledExpedientes, stalledLotes] = await Promise.all([
      db
        .select({
          id: expedientes.id,
          reference: expedientes.reference,
          status: expedientes.status,
          statusSince: expedientes.statusSince,
          assigneeId: expedientes.assigneeId,
        })
        .from(expedientes)
        .where(
          and(
            eq(expedientes.organizationId, u.organizationId),
            notInArray(expedientes.status, FINAL_EXPEDIENTE_STATUSES),
          ),
        )
        .orderBy(asc(expedientes.statusSince))
        .limit(200),
      db
        .select({
          id: lotes.id,
          reference: lotes.reference,
          status: lotes.status,
          statusSince: lotes.statusSince,
          assigneeId: lotes.assigneeId,
        })
        .from(lotes)
        .where(and(eq(lotes.organizationId, u.organizationId), notInArray(lotes.status, ["issued"])))
        .orderBy(asc(lotes.statusSince))
        .limit(200),
    ]);

    return [
      ...stalledExpedientes.map((e) => ({ kind: "expediente" as const, ...e })),
      ...stalledLotes.map((l) => ({ kind: "lote" as const, ...l })),
    ]
      .map((x) => {
        const days = daysSince(x.statusSince);
        return { ...x, days, color: colorFor(days) };
      })
      .sort((a, b) => b.days - a.days);
  });

  /** Automatic lote proposals for a ficha (F-10). */
  app.get("/lote-proposals", { preHandler: requireRole("verifier", "director") }, async (req) => {
    const u = currentUser(req);
    const { ficha: code } = z.object({ ficha: z.string() }).parse(req.query);
    const grouping = catalog.versions(code).at(-1)?.grouping;
    if (!grouping) throw new HttpError(404, "Ficha no encontrada");
    if (!grouping.required) return [];

    const rows = await db
      .select()
      .from(expedientes)
      .where(and(eq(expedientes.organizationId, u.organizationId), eq(expedientes.fichaCode, code)));

    return proposeLotes(
      rows.map((e) => ({
        id: e.id,
        status: e.status as ExpedienteStatus,
        savingsKwh: e.savingsKwh ?? 0,
        values: { ...e.data, region: e.region, year: e.year },
      })),
      grouping,
    );
  });
}
