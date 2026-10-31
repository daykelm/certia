import type { CaseStatus } from "@certia/shared";
import type { Grouping } from "../measure/schema.js";

/**
 * Automatic batch proposals (F-10).
 * Groups cases by the measure's keys (e.g. region and year)
 * and compares the accumulated savings with the required minimum.
 */

export interface GroupableCase {
  id: string;
  status: CaseStatus;
  savingsKwh: number;
  /** Values available for the keys: case columns and measure fields. */
  values: Record<string, unknown>;
}

export interface BatchProposal {
  key: Record<string, string>;
  label: string;
  /** Complete cases that can join the batch right away. */
  complete: string[];
  totalKwh: number;
  meetsMinimum: boolean;
  missingKwh: number;
  /** Almost-complete cases that would count once completed. */
  candidates: string[];
  potentialKwh: number;
}

const CANDIDATE_STATUSES: ReadonlySet<CaseStatus> = new Set(["pending_review", "incomplete"]);

export function proposeBatches(cases: GroupableCase[], grouping: Grouping): BatchProposal[] {
  const groups = new Map<string, BatchProposal>();

  for (const c of cases) {
    const isComplete = c.status === "complete";
    if (!isComplete && !CANDIDATE_STATUSES.has(c.status)) continue;

    const key: Record<string, string> = {};
    let missingKey = false;
    for (const k of grouping.keys) {
      const v = c.values[k];
      if (v === undefined || v === null || v === "") missingKey = true;
      key[k] = String(v ?? "");
    }
    if (missingKey) continue; // cannot be grouped without a value for every key

    const label = grouping.keys.map((k) => key[k]).join(" · ") || "all";
    let group = groups.get(label);
    if (!group) {
      group = { key, label, complete: [], totalKwh: 0, meetsMinimum: false, missingKwh: 0, candidates: [], potentialKwh: 0 };
      groups.set(label, group);
    }

    if (isComplete) {
      group.complete.push(c.id);
      group.totalKwh += c.savingsKwh;
    } else {
      group.candidates.push(c.id);
    }
    group.potentialKwh += c.savingsKwh;
  }

  const proposals = [...groups.values()];
  for (const p of proposals) {
    p.meetsMinimum = p.complete.length > 0 && p.totalKwh >= grouping.min_kwh;
    p.missingKwh = Math.max(0, grouping.min_kwh - p.totalKwh);
  }
  // Ready-to-send groups first, then the ones closest to the minimum.
  return proposals.sort((a, b) => Number(b.meetsMinimum) - Number(a.meetsMinimum) || b.totalKwh - a.totalKwh);
}
