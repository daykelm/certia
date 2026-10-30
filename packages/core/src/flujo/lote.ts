import type { EstadoLote } from "@certia/shared";

/**
 * Lote state machine (PROJECT.md §6).
 */

export const TRANSICIONES_LOTE: Record<EstadoLote, readonly EstadoLote[]> = {
  borrador: ["preparado_verificacion"],
  preparado_verificacion: ["borrador", "en_verificacion"],
  en_verificacion: ["subsanacion_verificacion", "dictamen_favorable"],
  subsanacion_verificacion: ["en_verificacion"],
  dictamen_favorable: ["preparado_emision"],
  preparado_emision: ["en_emision"],
  en_emision: ["subsanacion_emision", "emitido"],
  subsanacion_emision: ["en_emision"],
  emitido: [],
};

/** Expedientes can be added or removed while the lote is in these states. */
export const LOTE_EDITABLE: ReadonlySet<EstadoLote> = new Set(["borrador", "preparado_verificacion"]);

export interface ContextoLote {
  alcanzaMinimo: boolean;
  numActuaciones: number;
  tareasAbiertas: number;
}

export function puedeTransicionarLote(
  desde: EstadoLote,
  hasta: EstadoLote,
  ctx: ContextoLote,
): { ok: boolean; motivos: string[] } {
  if (!TRANSICIONES_LOTE[desde].includes(hasta)) {
    return { ok: false, motivos: [`No se puede pasar de "${desde}" a "${hasta}"`] };
  }
  const motivos: string[] = [];
  if (hasta === "preparado_verificacion") {
    if (ctx.numActuaciones === 0) motivos.push("El lote no tiene expedientes");
    if (!ctx.alcanzaMinimo) motivos.push("El lote no alcanza el ahorro mínimo");
  }
  if ((hasta === "en_verificacion" || hasta === "en_emision") && ctx.tareasAbiertas > 0) {
    motivos.push(`Hay ${ctx.tareasAbiertas} tarea(s) abierta(s) en el lote`);
  }
  return { ok: motivos.length === 0, motivos };
}
