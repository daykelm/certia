export * from "./interfaces.js";
export * from "./almacenamiento-local.js";
export * from "./cola-postgres.js";
export * from "./gotenberg.js";
export * from "./simples.js";
export * from "./cifrado.js";

import type { Db } from "@certia/db";
import { AlmacenamientoLocal } from "./almacenamiento-local.js";
import { ColaPostgres } from "./cola-postgres.js";
import { ConversorGotenberg } from "./gotenberg.js";
import type { Almacenamiento, Cola, ConversorPdf, Correo, ExtractorIa } from "./interfaces.js";
import { CorreoConsola, ExtractorManual } from "./simples.js";

export interface Adaptadores {
  almacenamiento: Almacenamiento;
  cola: Cola;
  pdf: ConversorPdf;
  ia: ExtractorIa;
  correo: Correo;
}

/**
 * Elige las implementaciones según las variables de entorno.
 * Las de Google Cloud (Cloud Storage, Cloud Tasks, Vertex AI) se añaden aquí sin tocar el resto.
 */
export function crearAdaptadores(db: Db, env = process.env): Adaptadores {
  const storage = env.STORAGE_DRIVER ?? "local";
  if (storage !== "local") throw new Error(`STORAGE_DRIVER=${storage} aún no está implementado`);
  const queue = env.QUEUE_DRIVER ?? "postgres";
  if (queue !== "postgres") throw new Error(`QUEUE_DRIVER=${queue} aún no está implementado`);
  const ai = env.AI_PROVIDER ?? "none";
  if (ai !== "none") throw new Error(`AI_PROVIDER=${ai} aún no está implementado`);

  return {
    almacenamiento: new AlmacenamientoLocal(env.STORAGE_LOCAL_DIR ?? ".storage"),
    cola: new ColaPostgres(db),
    pdf: new ConversorGotenberg(env.GOTENBERG_URL ?? "http://localhost:3001"),
    ia: new ExtractorManual(),
    correo: new CorreoConsola(),
  };
}
