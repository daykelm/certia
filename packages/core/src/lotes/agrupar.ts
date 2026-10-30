import type { EstadoExpediente } from "@certia/shared";
import type { Agrupacion } from "../ficha/schema.js";

/**
 * Propuesta automática de lotes (F-10).
 * Agrupa expedientes por las claves de la ficha (p. ej. comunidad autónoma y año)
 * y compara el ahorro acumulado con el mínimo exigido.
 */

export interface ActuacionAgrupable {
  id: string;
  estado: EstadoExpediente;
  ahorroKwh: number;
  /** Valores disponibles para las claves: columnas del expediente y campos de la ficha. */
  valores: Record<string, unknown>;
}

export interface PropuestaLote {
  clave: Record<string, string>;
  etiqueta: string;
  /** Expedientes completos que pueden entrar ya en el lote. */
  completas: string[];
  totalKwh: number;
  alcanzaMinimo: boolean;
  faltanKwh: number;
  /** Expedientes casi completos que sumarían si se completan. */
  candidatas: string[];
  totalPotencialKwh: number;
}

const ESTADOS_CANDIDATOS: ReadonlySet<EstadoExpediente> = new Set(["pendiente_revision", "incompleto"]);

export function proponerLotes(actuaciones: ActuacionAgrupable[], regla: Agrupacion): PropuestaLote[] {
  const grupos = new Map<string, PropuestaLote>();

  for (const a of actuaciones) {
    const esCompleta = a.estado === "completo";
    if (!esCompleta && !ESTADOS_CANDIDATOS.has(a.estado)) continue;

    const clave: Record<string, string> = {};
    let incompleta = false;
    for (const k of regla.claves) {
      const v = a.valores[k];
      if (v === undefined || v === null || v === "") incompleta = true;
      clave[k] = String(v ?? "");
    }
    if (incompleta) continue; // sin valor en alguna clave no se puede agrupar

    const etiqueta = regla.claves.map((k) => clave[k]).join(" · ") || "todas";
    let grupo = grupos.get(etiqueta);
    if (!grupo) {
      grupo = {
        clave,
        etiqueta,
        completas: [],
        totalKwh: 0,
        alcanzaMinimo: false,
        faltanKwh: 0,
        candidatas: [],
        totalPotencialKwh: 0,
      };
      grupos.set(etiqueta, grupo);
    }

    if (esCompleta) {
      grupo.completas.push(a.id);
      grupo.totalKwh += a.ahorroKwh;
    } else {
      grupo.candidatas.push(a.id);
    }
    grupo.totalPotencialKwh += a.ahorroKwh;
  }

  const propuestas = [...grupos.values()];
  for (const p of propuestas) {
    p.alcanzaMinimo = p.completas.length > 0 && p.totalKwh >= regla.minimo_kwh;
    p.faltanKwh = Math.max(0, regla.minimo_kwh - p.totalKwh);
  }
  // Primero los que ya pueden enviarse; después, los más cercanos al mínimo.
  return propuestas.sort(
    (a, b) => Number(b.alcanzaMinimo) - Number(a.alcanzaMinimo) || b.totalKwh - a.totalKwh,
  );
}
