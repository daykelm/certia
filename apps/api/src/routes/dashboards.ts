import type { FastifyInstance } from "fastify";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { proposeBatches } from "@certia/core";
import { batches, cases } from "@certia/db";
import type { CaseStatus } from "@certia/shared";
import { z } from "zod";
import { currentUser, HttpError, requireRole, type Services } from "../context.js";

/** Traffic-light thresholds in days (F-13). To be made configurable. */
const THRESHOLDS = { amber: 7, red: 14 };
/** Final states, excluded from the traffic light. */
const FINAL_CASE_STATUSES = ["issued", "discarded"];

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
    const [stalledCases, stalledBatches] = await Promise.all([
      db
        .select({
          id: cases.id,
          reference: cases.reference,
          status: cases.status,
          statusSince: cases.statusSince,
          assigneeId: cases.assigneeId,
        })
        .from(cases)
        .where(and(eq(cases.organizationId, u.organizationId), notInArray(cases.status, FINAL_CASE_STATUSES)))
        .orderBy(asc(cases.statusSince))
        .limit(200),
      db
        .select({
          id: batches.id,
          reference: batches.reference,
          status: batches.status,
          statusSince: batches.statusSince,
          assigneeId: batches.assigneeId,
        })
        .from(batches)
        .where(and(eq(batches.organizationId, u.organizationId), notInArray(batches.status, ["issued"])))
        .orderBy(asc(batches.statusSince))
        .limit(200),
    ]);

    return [
      ...stalledCases.map((c) => ({ kind: "case" as const, ...c })),
      ...stalledBatches.map((b) => ({ kind: "batch" as const, ...b })),
    ]
      .map((x) => {
        const days = daysSince(x.statusSince);
        return { ...x, days, color: colorFor(days) };
      })
      .sort((a, b) => b.days - a.days);
  });

  /** Automatic batch proposals for a measure (F-10). */
  app.get("/batch-proposals", { preHandler: requireRole("verifier", "director") }, async (req) => {
    const u = currentUser(req);
    const { measure: code } = z.object({ measure: z.string() }).parse(req.query);
    const grouping = catalog.versions(code).at(-1)?.grouping;
    if (!grouping) throw new HttpError(404, "Measure not found");
    if (!grouping.required) return [];

    const rows = await db
      .select()
      .from(cases)
      .where(and(eq(cases.organizationId, u.organizationId), eq(cases.measureCode, code)));

    return proposeBatches(
      rows.map((c) => ({
        id: c.id,
        status: c.status as CaseStatus,
        savingsKwh: c.savingsKwh ?? 0,
        values: { ...c.data, region: c.region, year: c.year },
      })),
      grouping,
    );
  });
}
