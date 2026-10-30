import type { Adaptadores } from "@certia/adapters";
import type { Db } from "@certia/db";
import type { Catalogo } from "@certia/fichas";

export interface ContextoTarea {
  db: Db;
  adaptadores: Adaptadores;
  catalogo: Catalogo;
}

export type Manejador = (payload: Record<string, unknown>, ctx: ContextoTarea) => Promise<void>;

/**
 * Background job registry. Every job type enqueued with
 * `cola.encolar(tipo, payload)` needs a handler here.
 */
export const manejadores: Record<string, Manejador> = {
  /** End-to-end check of the queue. */
  "sistema.ping": async (payload) => {
    console.log("[worker] ping", payload);
  },

  // TODO(F-06): convert an uploaded document to PDF, rename and compress it.
  // "documento.normalizar": async ({ documentoId }, { db, adaptadores }) => { ... },

  // TODO(F-05): classify the document and extract the ficha's fields.
  // "documento.extraer": async ({ documentoId }, { db, adaptadores, catalogo }) => { ... },

  // TODO(F-13): daily alerts for stalled expedientes and lotes.
  // "paneles.avisos_atascos": async (_, { db, adaptadores }) => { ... },
};
