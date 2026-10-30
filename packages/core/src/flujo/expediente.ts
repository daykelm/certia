import type { EstadoExpediente } from "@certia/shared";

/**
 * Expediente state machine (PROJECT.md §6).
 */

export const TRANSICIONES_EXPEDIENTE: Record<EstadoExpediente, readonly EstadoExpediente[]> = {
  lead: ["pendiente_documentacion", "descartado"],
  pendiente_documentacion: ["pendiente_revision", "descartado"],
  pendiente_revision: ["incompleto", "completo"],
  incompleto: ["pendiente_revision", "descartado"],
  completo: ["en_lote", "incompleto"],
  en_lote: ["completo", "verificado"],
  verificado: ["emitido"],
  emitido: [],
  descartado: ["lead"],
};

/** States that only change through the lote workflow, never by hand. */
const GESTIONADOS_POR_LOTE: ReadonlySet<EstadoExpediente> = new Set(["en_lote", "verificado", "emitido"]);

export interface ContextoExpediente {
  checklistCompleta: boolean;
  ahorroCalculado: boolean;
  /** Who triggers the change: a user or the lote workflow. */
  origen: "usuario" | "lote";
}

export interface ResultadoTransicion {
  ok: boolean;
  motivos: string[];
}

export function puedeTransicionar(
  desde: EstadoExpediente,
  hasta: EstadoExpediente,
  ctx: ContextoExpediente,
): ResultadoTransicion {
  const motivos: string[] = [];

  if (!TRANSICIONES_EXPEDIENTE[desde].includes(hasta)) {
    return { ok: false, motivos: [`No se puede pasar de "${desde}" a "${hasta}"`] };
  }

  const tocaLote = GESTIONADOS_POR_LOTE.has(hasta) || GESTIONADOS_POR_LOTE.has(desde);
  if (tocaLote && ctx.origen !== "lote") {
    motivos.push("Este cambio de estado se hace desde el lote");
  }

  if (hasta === "completo") {
    if (!ctx.checklistCompleta) motivos.push("Faltan documentos obligatorios por validar");
    if (!ctx.ahorroCalculado) motivos.push("El ahorro no está calculado");
  }

  return { ok: motivos.length === 0, motivos };
}
