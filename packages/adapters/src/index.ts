import type { Db } from "@certia/db";
import { GotenbergConverter } from "./gotenberg.js";
import type { AiExtractor, Mailer, PdfConverter, Queue, Storage } from "./interfaces.js";
import { LocalStorage } from "./local-storage.js";
import { PostgresQueue } from "./postgres-queue.js";
import { ConsoleMailer, ManualExtractor } from "./stubs.js";

export * from "./interfaces.js";
export * from "./local-storage.js";
export * from "./postgres-queue.js";
export * from "./gotenberg.js";
export * from "./stubs.js";
export * from "./encryption.js";

export interface Adapters {
  storage: Storage;
  queue: Queue;
  pdf: PdfConverter;
  ai: AiExtractor;
  mailer: Mailer;
}

/**
 * Picks the implementations from environment variables.
 * Google Cloud ones (Cloud Storage, Cloud Tasks, Vertex AI) plug in here without touching anything else.
 */
export function createAdapters(db: Db, env = process.env): Adapters {
  const storage = env.STORAGE_DRIVER ?? "local";
  if (storage !== "local") throw new Error(`STORAGE_DRIVER=${storage} is not implemented yet`);
  const queue = env.QUEUE_DRIVER ?? "postgres";
  if (queue !== "postgres") throw new Error(`QUEUE_DRIVER=${queue} is not implemented yet`);
  const ai = env.AI_PROVIDER ?? "none";
  if (ai !== "none") throw new Error(`AI_PROVIDER=${ai} is not implemented yet`);

  return {
    storage: new LocalStorage(env.STORAGE_LOCAL_DIR ?? ".storage"),
    queue: new PostgresQueue(db),
    pdf: new GotenbergConverter(env.GOTENBERG_URL ?? "http://localhost:3001"),
    ai: new ManualExtractor(),
    mailer: new ConsoleMailer(env.MAIL_FROM),
  };
}
