import { calcularAhorro, type ResultadoCalculo } from "./calculo.js";
import type { Ficha } from "./schema.js";

/**
 * Comparador de versiones de ficha (F-07).
 * Calcula el ahorro de los mismos datos con cada versión y señala la más favorable.
 */

export interface ComparacionVersion {
  codigo: string;
  version: number;
  resultado: ResultadoCalculo;
  /** Documentos que exige esta versión y no exigen las demás. */
  documentosExclusivos: string[];
}

export interface Comparacion {
  versiones: ComparacionVersion[];
  /** Versión con mayor ahorro entre las que se pueden calcular. */
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
