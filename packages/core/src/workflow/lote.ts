import type { LoteStatus } from "@certia/shared";

/**
 * Lote state machine (PROJECT.md §6).
 */

export const LOTE_TRANSITIONS: Record<LoteStatus, readonly LoteStatus[]> = {
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

/** Expedientes can be added or removed while the lote is in these states. */
export const LOTE_EDITABLE: ReadonlySet<LoteStatus> = new Set(["draft", "ready_for_verification"]);

export interface LoteContext {
  meetsMinimum: boolean;
  expedienteCount: number;
  openTasks: number;
}

export function canTransitionLote(
  from: LoteStatus,
  to: LoteStatus,
  ctx: LoteContext,
): { ok: boolean; reasons: string[] } {
  if (!LOTE_TRANSITIONS[from].includes(to)) {
    return { ok: false, reasons: [`No se puede pasar de "${from}" a "${to}"`] };
  }
  const reasons: string[] = [];
  if (to === "ready_for_verification") {
    if (ctx.expedienteCount === 0) reasons.push("El lote no tiene expedientes");
    if (!ctx.meetsMinimum) reasons.push("El lote no alcanza el ahorro mínimo");
  }
  if ((to === "in_verification" || to === "in_issuance") && ctx.openTasks > 0) {
    reasons.push(`Hay ${ctx.openTasks} tarea(s) abierta(s) en el lote`);
  }
  return { ok: reasons.length === 0, reasons };
}
