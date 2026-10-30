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
 * Registro de tareas en segundo plano. Cada tipo de trabajo encolado
 * con `cola.encolar(tipo, payload)` necesita su manejador aquí.
 */
export const manejadores: Record<string, Manejador> = {
  /** Prueba de extremo a extremo de la cola. */
  "sistema.ping": async (payload) => {
    console.log("[worker] ping", payload);
  },

  // TODO(F-06): convertir a PDF, renombrar y comprimir un documento subido.
  // "documento.normalizar": async ({ documentoId }, { db, adaptadores }) => { ... },

  // TODO(F-05): clasificar el documento y extraer los campos de la ficha.
  // "documento.extraer": async ({ documentoId }, { db, adaptadores, catalogo }) => { ... },

  // TODO(F-13): avisos diarios de expedientes y lotes atascados.
  // "paneles.avisos_atascos": async (_, { db, adaptadores }) => { ... },
};
