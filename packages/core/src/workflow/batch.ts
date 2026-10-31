import type { BatchStatus } from "@certia/shared";

/**
 * Batch state machine (PROJECT.md §6).
 */

export const BATCH_TRANSITIONS: Record<BatchStatus, readonly BatchStatus[]> = {
  draft: ["ready_for_verification"],
  ready_for_verification: ["draft", "in_verification"],
  in_verification: ["verification_corrections", "favorable_opinion"],
  verification_corrections: ["in_verification"],
  favorable_opinion: ["ready_for_issuance"],
  ready_for_issuance: ["in_issuance"],
  in_issuance: ["issuance_corrections", "issued"],
  issuance_corrections: ["in_issuance"],
  issued: [],
};

/** Cases can be added or removed while the batch is in these states. */
export const BATCH_EDITABLE: ReadonlySet<BatchStatus> = new Set(["draft", "ready_for_verification"]);

export interface BatchContext {
  meetsMinimum: boolean;
  caseCount: number;
  openTasks: number;
}

export function canTransitionBatch(
  from: BatchStatus,
  to: BatchStatus,
  ctx: BatchContext,
): { ok: boolean; reasons: string[] } {
  if (!BATCH_TRANSITIONS[from].includes(to)) {
    return { ok: false, reasons: [`Cannot move from "${from}" to "${to}"`] };
  }
  const reasons: string[] = [];
  if (to === "ready_for_verification") {
    if (ctx.caseCount === 0) reasons.push("The batch has no cases");
    if (!ctx.meetsMinimum) reasons.push("The batch does not reach the minimum savings");
  }
  if ((to === "in_verification" || to === "in_issuance") && ctx.openTasks > 0) {
    reasons.push(`The batch has ${ctx.openTasks} open task(s)`);
  }
  return { ok: reasons.length === 0, reasons };
}
