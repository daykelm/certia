import type { Adapters } from "@certia/adapters";
import type { Db } from "@certia/db";
import type { Catalog } from "@certia/measures";

export interface JobContext {
  db: Db;
  adapters: Adapters;
  catalog: Catalog;
}

export type JobHandler = (payload: Record<string, unknown>, ctx: JobContext) => Promise<void>;

/**
 * Background job registry. Every job type enqueued with
 * `queue.enqueue(type, payload)` needs a handler here.
 */
export const handlers: Record<string, JobHandler> = {
  /** End-to-end check of the queue. */
  "system.ping": async (payload) => {
    console.log("[worker] ping", payload);
  },

  // TODO(F-06): convert an uploaded document to PDF, rename and compress it.
  // "document.normalize": async ({ documentId }, { db, adapters }) => { ... },

  // TODO(F-05): classify the document and extract the measure's fields.
  // "document.extract": async ({ documentId }, { db, adapters, catalog }) => { ... },

  // TODO(F-13): daily alerts for stalled cases and batches.
  // "dashboards.stalled_alerts": async (_, { db, adapters }) => { ... },
};
