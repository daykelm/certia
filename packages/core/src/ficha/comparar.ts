import { calcularAhorro, type ResultadoCalculo } from "./calculo.js";
import type { Ficha } from "./schema.js";

/**
 * Ficha version comparator (F-07).
 * Calculates the savings for the same data with every version and flags the most favorable one.
 */

export interface ComparacionVersion {
  codigo: string;
  version: number;
  resultado: ResultadoCalculo;
  /** Documents required by this version and by no other. */
  documentosExclusivos: string[];
}

export interface Comparacion {
  versiones: ComparacionVersion[];
  /** Version with the highest savings among those that can be calculated. */
  mejor?: { codigo: string; version: number; kwh: number };
}

export function compararVersiones(fichas: Ficha[], datos: Record<string, unknown>): Comparacion {
  const tiposPorVersion = fichas.map((f) => new Set(f.documentos.map((d) => d.tipo)));

  const versiones = fichas.map((ficha, i) => {
    const propios = tiposPorVersion[i] ?? new Set<string>();
    const otros = tiposPorVersion.filter((_, j) => j !== i);
    const documentosExclusivos = [...propios].filter((t) => otros.every((o) => !o.has(t)));
    return {
      codigo: ficha.codigo,
      version: ficha.version,
      resultado: calcularAhorro(ficha, datos),
      documentosExclusivos,
    };
  });

  let mejor: Comparacion["mejor"];
  for (const v of versiones) {
    if (v.resultado.ok && (!mejor || v.resultado.kwh > mejor.kwh)) {
      mejor = { codigo: v.codigo, version: v.version, kwh: v.resultado.kwh };
    }
  }
  return { versiones, mejor };
}
