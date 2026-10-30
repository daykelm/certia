import type { ExpedienteStatus } from "@certia/shared";
import type { Grouping } from "../ficha/schema.js";

/**
 * Automatic lote proposals (F-10).
 * Groups expedientes by the ficha's keys (e.g. region and year)
 * and compares the accumulated savings with the required minimum.
 */

export interface GroupableExpediente {
  id: string;
  status: ExpedienteStatus;
  savingsKwh: number;
  /** Values available for the keys: expediente columns and ficha fields. */
  values: Record<string, unknown>;
}

export interface LoteProposal {
  key: Record<string, string>;
  label: string;
  /** Complete expedientes that can join the lote right away. */
  complete: string[];
  totalKwh: number;
  meetsMinimum: boolean;
  missingKwh: number;
  /** Almost-complete expedientes that would count once completed. */
  candidates: string[];
  potentialKwh: number;
}

const CANDIDATE_STATUSES: ReadonlySet<ExpedienteStatus> = new Set(["pending_review", "incomplete"]);

export function proposeLotes(expedientes: GroupableExpediente[], grouping: Grouping): LoteProposal[] {
  const groups = new Map<string, LoteProposal>();

  for (const e of expedientes) {
    const isComplete = e.status === "complete";
    if (!isComplete && !CANDIDATE_STATUSES.has(e.status)) continue;

    const key: Record<string, string> = {};
    let missingKey = false;
    for (const k of grouping.keys) {
      const v = e.values[k];
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
      group.complete.push(e.id);
      group.totalKwh += e.savingsKwh;
    } else {
      group.candidates.push(e.id);
    }
    group.potentialKwh += e.savingsKwh;
  }

  const proposals = [...groups.values()];
  for (const p of proposals) {
    p.meetsMinimum = p.complete.length > 0 && p.totalKwh >= grouping.min_kwh;
    p.missingKwh = Math.max(0, grouping.min_kwh - p.totalKwh);
  }
  // Ready-to-send groups first, then the ones closest to the minimum.
  return proposals.sort((a, b) => Number(b.meetsMinimum) - Number(a.meetsMinimum) || b.totalKwh - a.totalKwh);
}
