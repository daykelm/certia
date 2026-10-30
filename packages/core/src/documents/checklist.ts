import type { DocumentStatus } from "@certia/shared";
import { evaluateExpression } from "../ficha/calculation.js";
import type { Ficha } from "../ficha/schema.js";

/**
 * Document checklist of an expediente (F-08), derived from the ficha.
 */

export interface ExpedienteDocument {
  type: string;
  status: DocumentStatus;
}

export interface ChecklistItem {
  type: string;
  label: string;
  required: boolean;
  generated: boolean;
  /** false when the document's condition does not hold for this data. */
  applies: boolean;
  status: DocumentStatus;
}

export interface Checklist {
  items: ChecklistItem[];
  /** Every applicable required document is validated. */
  complete: boolean;
  missing: string[];
  errors: string[];
}

const STATUS_RANK: Record<DocumentStatus, number> = {
  validated: 3,
  uploaded: 2,
  rejected: 1,
  pending: 0,
};

export function buildChecklist(
  ficha: Ficha,
  data: Record<string, unknown>,
  documents: ExpedienteDocument[],
): Checklist {
  const errors: string[] = [];

  // With several documents of the same type, the best status wins.
  const statusByType = new Map<string, DocumentStatus>();
  for (const doc of documents) {
    const current = statusByType.get(doc.type);
    if (!current || STATUS_RANK[doc.status] > STATUS_RANK[current]) statusByType.set(doc.type, doc.status);
  }

  const items = ficha.documents.map((req) => {
    let applies = true;
    if (req.condition) {
      try {
        applies = Boolean(evaluateExpression(req.condition, { ...ficha.constants, ...data }));
      } catch (e) {
        // Not enough data to evaluate the condition: request the document to be safe.
        errors.push(`No se pudo evaluar la condición de "${req.type}": ${(e as Error).message}`);
      }
    }
    return {
      type: req.type,
      label: req.label,
      required: req.required,
      generated: req.generated,
      applies,
      status: statusByType.get(req.type) ?? "pending",
    } satisfies ChecklistItem;
  });

  const missing = items.filter((i) => i.applies && i.required && i.status !== "validated").map((i) => i.type);
  return { items, complete: missing.length === 0, missing, errors };
}
