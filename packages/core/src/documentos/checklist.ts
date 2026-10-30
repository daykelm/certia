import type { EstadoDocumento } from "@certia/shared";
import { evaluarExpresion } from "../ficha/calculo.js";
import type { Ficha } from "../ficha/schema.js";

/**
 * Document checklist of an expediente (F-08), derived from the ficha.
 */

export interface DocumentoExpediente {
  tipo: string;
  estado: EstadoDocumento;
}

export interface ItemChecklist {
  tipo: string;
  etiqueta: string;
  obligatorio: boolean;
  generado: boolean;
  /** false when the document's condition does not hold for this data. */
  aplica: boolean;
  estado: EstadoDocumento;
}

export interface Checklist {
  items: ItemChecklist[];
  /** Every applicable mandatory document is validated. */
  completa: boolean;
  faltan: string[];
  errores: string[];
}

const PRIORIDAD_ESTADO: Record<EstadoDocumento, number> = {
  validado: 3,
  subido: 2,
  rechazado: 1,
  pendiente: 0,
};

export function generarChecklist(
  ficha: Ficha,
  datos: Record<string, unknown>,
  documentos: DocumentoExpediente[],
): Checklist {
  const errores: string[] = [];

  // With several documents of the same type, the best state wins.
  const estadoPorTipo = new Map<string, EstadoDocumento>();
  for (const doc of documentos) {
    const actual = estadoPorTipo.get(doc.tipo);
    if (!actual || PRIORIDAD_ESTADO[doc.estado] > PRIORIDAD_ESTADO[actual]) {
      estadoPorTipo.set(doc.tipo, doc.estado);
    }
  }

  const items = ficha.documentos.map((req) => {
    let aplica = true;
    if (req.condicion) {
      try {
        aplica = Boolean(evaluarExpresion(req.condicion, { ...ficha.constantes, ...datos }));
      } catch (e) {
        // Not enough data to evaluate the condition: request the document to be safe.
        errores.push(`No se pudo evaluar la condición de "${req.tipo}": ${(e as Error).message}`);
      }
    }
    return {
      tipo: req.tipo,
      etiqueta: req.etiqueta,
      obligatorio: req.obligatorio,
      generado: req.generado,
      aplica,
      estado: estadoPorTipo.get(req.tipo) ?? "pendiente",
    } satisfies ItemChecklist;
  });

  const faltan = items
    .filter((i) => i.aplica && i.obligatorio && i.estado !== "validado")
    .map((i) => i.tipo);

  return { items, completa: faltan.length === 0, faltan, errores };
}
