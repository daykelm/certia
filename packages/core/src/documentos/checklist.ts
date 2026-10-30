import type { EstadoDocumento } from "@certia/shared";
import { evaluarExpresion } from "../ficha/calculo.js";
import type { Ficha } from "../ficha/schema.js";

/**
 * Checklist documental de un expediente (F-08), derivada de la ficha.
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
  /** false si la condición del documento no se cumple para estos datos. */
  aplica: boolean;
  estado: EstadoDocumento;
}

export interface Checklist {
  items: ItemChecklist[];
  /** Todos los documentos obligatorios que aplican están validados. */
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

  // Si hay varios documentos del mismo tipo, cuenta el de mejor estado.
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
        // Sin datos suficientes para evaluar la condición: se pide el documento por prudencia.
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
