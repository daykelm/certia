import type { EstadoExpediente } from "@certia/shared";
import type { Agrupacion } from "../ficha/schema.js";

/**
 * Automatic lote proposals (F-10).
 * Groups expedientes by the ficha's keys (e.g. autonomous community and year)
 * and compares the accumulated savings with the required minimum.
 */

export interface ActuacionAgrupable {
  id: string;
  estado: EstadoExpediente;
  ahorroKwh: number;
  /** Values available for the keys: expediente columns and ficha fields. */
  valores: Record<string, unknown>;
}

export interface PropuestaLote {
  clave: Record<string, string>;
  etiqueta: string;
  /** Complete expedientes that can join the lote right away. */
  completas: string[];
  totalKwh: number;
  alcanzaMinimo: boolean;
  faltanKwh: number;
  /** Almost-complete expedientes that would count once completed. */
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
    if (incompleta) continue; // cannot be grouped without a value for every key

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
  // Ready-to-send groups first, then the ones closest to the minimum.
  return propuestas.sort(
    (a, b) => Number(b.alcanzaMinimo) - Number(a.alcanzaMinimo) || b.totalKwh - a.totalKwh,
  );
}
