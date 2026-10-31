import { calculateSavings, type CalculationResult } from "./calculation.js";
import type { Measure } from "./schema.js";

/**
 * Measure version comparator (F-07).
 *
 * Calculates the savings for the same data with every version of a measure, turns them
 * into money with a price per kWh, and compares each version against a baseline
 * (the case's current version, or the oldest version when there is no case).
 */

export interface CompareOptions {
  /** Price paid per kWh of savings, in euros. Without it, only kWh are compared. */
  pricePerKwh?: number;
  /** Version used as the reference for differences. Defaults to the oldest version. */
  baselineVersion?: number;
}

export interface Difference {
  kwh: number;
  eur: number | null;
  /** Relative change against the baseline; null when the baseline is 0 or not calculable. */
  percent: number | null;
}

export interface VersionComparison {
  code: string;
  version: number;
  name: string;
  validity: Measure["validity"];
  result: CalculationResult;
  /** Payout in euros; null when the savings cannot be calculated or there is no price. */
  payoutEur: number | null;
  /** Difference against the baseline; null for the baseline itself or when not calculable. */
  vsBaseline: Difference | null;
  isBaseline: boolean;
  isBest: boolean;
  /** Documents required by this version and by no other. */
  exclusiveDocuments: string[];
}

export interface Comparison {
  pricePerKwh: number | null;
  baselineVersion: number;
  versions: VersionComparison[];
  /** Version with the highest savings among those that can be calculated. */
  best?: { code: string; version: number; kwh: number; payoutEur: number | null };
  /** What switching from the baseline to the best version would change. */
  gainVsBaseline: Difference | null;
}

const roundEur = (n: number) => Math.round(n * 100) / 100;

function difference(kwh: number, baselineKwh: number, price: number | null): Difference {
  const deltaKwh = kwh - baselineKwh;
  return {
    kwh: deltaKwh,
    eur: price === null ? null : roundEur(deltaKwh * price),
    percent: baselineKwh === 0 ? null : Math.round((deltaKwh / baselineKwh) * 1000) / 10,
  };
}

export function compareVersions(
  measures: Measure[],
  data: Record<string, unknown>,
  options: CompareOptions = {},
): Comparison {
  if (measures.length === 0) throw new Error("No versions to compare");
  if (options.pricePerKwh !== undefined && !(options.pricePerKwh >= 0)) {
    throw new Error("pricePerKwh must be zero or positive");
  }

  const sorted = [...measures].sort((a, b) => a.version - b.version);
  const price = options.pricePerKwh ?? null;
  const baselineVersion = options.baselineVersion ?? sorted[0]!.version;
  if (!sorted.some((m) => m.version === baselineVersion)) {
    throw new Error(`Baseline version ${baselineVersion} is not among the compared versions`);
  }

  const typesByVersion = sorted.map((m) => new Set(m.documents.map((d) => d.type)));
  const results = sorted.map((m) => calculateSavings(m, data));
  const baselineIndex = sorted.findIndex((m) => m.version === baselineVersion);
  const baselineResult = results[baselineIndex]!;

  let bestIndex = -1;
  results.forEach((r, i) => {
    const current = results[bestIndex];
    if (r.ok && (bestIndex === -1 || (current?.ok && r.kwh > current.kwh))) bestIndex = i;
  });

  const versions = sorted.map((measure, i): VersionComparison => {
    const result = results[i]!;
    const own = typesByVersion[i] ?? new Set<string>();
    const others = typesByVersion.filter((_, j) => j !== i);
    const isBaseline = i === baselineIndex;
    return {
      code: measure.code,
      version: measure.version,
      name: measure.name,
      validity: measure.validity,
      result,
      payoutEur: result.ok && price !== null ? roundEur(result.kwh * price) : null,
      vsBaseline: !isBaseline && result.ok && baselineResult.ok ? difference(result.kwh, baselineResult.kwh, price) : null,
      isBaseline,
      isBest: i === bestIndex,
      exclusiveDocuments: [...own].filter((t) => others.every((o) => !o.has(t))),
    };
  });

  const bestEntry = versions[bestIndex];
  const best =
    bestEntry && bestEntry.result.ok
      ? { code: bestEntry.code, version: bestEntry.version, kwh: bestEntry.result.kwh, payoutEur: bestEntry.payoutEur }
      : undefined;

  const gainVsBaseline =
    best && baselineResult.ok && best.version !== baselineVersion ? difference(best.kwh, baselineResult.kwh, price) : null;

  return { pricePerKwh: price, baselineVersion, versions, best, gainVsBaseline };
}
