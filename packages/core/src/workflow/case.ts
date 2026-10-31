import type { CaseStatus } from "@certia/shared";

/**
 * Case state machine (PROJECT.md §6).
 */

export const CASE_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  lead: ["awaiting_documents", "discarded"],
  awaiting_documents: ["pending_review", "discarded"],
  pending_review: ["incomplete", "complete"],
  incomplete: ["pending_review", "discarded"],
  complete: ["in_batch", "incomplete"],
  in_batch: ["complete", "verified"],
  verified: ["issued"],
  issued: [],
  discarded: ["lead"],
};

/** States that only change through the batch workflow, never by hand. */
const BATCH_DRIVEN: ReadonlySet<CaseStatus> = new Set(["in_batch", "verified", "issued"]);

export interface CaseContext {
  checklistComplete: boolean;
  savingsCalculated: boolean;
  /** Who triggers the change: a user or the batch workflow. */
  origin: "user" | "batch";
}

export interface TransitionResult {
  ok: boolean;
  /** User-facing reasons. */
  reasons: string[];
}

export function canTransition(from: CaseStatus, to: CaseStatus, ctx: CaseContext): TransitionResult {
  if (!CASE_TRANSITIONS[from].includes(to)) {
    return { ok: false, reasons: [`Cannot move from "${from}" to "${to}"`] };
  }

  const reasons: string[] = [];
  if ((BATCH_DRIVEN.has(to) || BATCH_DRIVEN.has(from)) && ctx.origin !== "batch") {
    reasons.push("This status change is made from the batch");
  }
  if (to === "complete") {
    if (!ctx.checklistComplete) reasons.push("Required documents are still pending validation");
    if (!ctx.savingsCalculated) reasons.push("Savings have not been calculated");
  }
  return { ok: reasons.length === 0, reasons };
}
