import { calculateSavings, type CalculationResult } from "./calculation.js";
import type { Ficha } from "./schema.js";

/**
 * Ficha version comparator (F-07).
 * Calculates the savings for the same data with every version and flags the most favorable one.
 */

export interface VersionComparison {
  code: string;
  version: number;
  result: CalculationResult;
  /** Documents required by this version and by no other. */
  exclusiveDocuments: string[];
}

export interface Comparison {
  versions: VersionComparison[];
  /** Version with the highest savings among those that can be calculated. */
  best?: { code: string; version: number; kwh: number };
}

export function compareVersions(fichas: Ficha[], data: Record<string, unknown>): Comparison {
  const typesByVersion = fichas.map((f) => new Set(f.documents.map((d) => d.type)));

  const versions = fichas.map((ficha, i) => {
    const own = typesByVersion[i] ?? new Set<string>();
    const others = typesByVersion.filter((_, j) => j !== i);
    return {
      code: ficha.code,
      version: ficha.version,
      result: calculateSavings(ficha, data),
      exclusiveDocuments: [...own].filter((t) => others.every((o) => !o.has(t))),
    };
  });

  let best: Comparison["best"];
  for (const v of versions) {
    if (v.result.ok && (!best || v.result.kwh > best.kwh)) {
      best = { code: v.code, version: v.version, kwh: v.result.kwh };
    }
  }
  return { versions, best };
}
