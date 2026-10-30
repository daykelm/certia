import type { ExpedienteStatus } from "@certia/shared";

/**
 * Expediente state machine (PROJECT.md §6).
 */

export const EXPEDIENTE_TRANSITIONS: Record<ExpedienteStatus, readonly ExpedienteStatus[]> = {
  lead: ["awaiting_documents", "discarded"],
  awaiting_documents: ["pending_review", "discarded"],
  pending_review: ["incomplete", "complete"],
  incomplete: ["pending_review", "discarded"],
  complete: ["in_lote", "incomplete"],
  in_lote: ["complete", "verified"],
  verified: ["issued"],
  issued: [],
  discarded: ["lead"],
};

/** States that only change through the lote workflow, never by hand. */
const LOTE_DRIVEN: ReadonlySet<ExpedienteStatus> = new Set(["in_lote", "verified", "issued"]);

export interface ExpedienteContext {
  checklistComplete: boolean;
  savingsCalculated: boolean;
  /** Who triggers the change: a user or the lote workflow. */
  origin: "user" | "lote";
}

export interface TransitionResult {
  ok: boolean;
  /** User-facing reasons (Spanish). */
  reasons: string[];
}

export function canTransition(from: ExpedienteStatus, to: ExpedienteStatus, ctx: ExpedienteContext): TransitionResult {
  if (!EXPEDIENTE_TRANSITIONS[from].includes(to)) {
    return { ok: false, reasons: [`No se puede pasar de "${from}" a "${to}"`] };
  }

  const reasons: string[] = [];
  if ((LOTE_DRIVEN.has(to) || LOTE_DRIVEN.has(from)) && ctx.origin !== "lote") {
    reasons.push("Este cambio de estado se hace desde el lote");
  }
  if (to === "complete") {
    if (!ctx.checklistComplete) reasons.push("Faltan documentos obligatorios por validar");
    if (!ctx.savingsCalculated) reasons.push("El ahorro no está calculado");
  }
  return { ok: reasons.length === 0, reasons };
}
