import { fileURLToPath } from "node:url";
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema.js";

export * as schema from "./schema.js";
export * from "./schema.js";
export { syncMeasures } from "./sync-measures.js";

export type Db = NodePgDatabase<typeof schema>;
/** Database or transaction: both can be written to. */
export type DbOrTx = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

/**
 * Applies pending migrations. In the Docker image the folder is set with
 * MIGRATIONS_DIR; in development it is resolved relative to this package.
 */
export async function runMigrations(url = process.env.DATABASE_URL) {
  const folder = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../migrations", import.meta.url));
  const { db, pool } = createDb(url);
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}

export interface NewEvent {
  organizationId: string;
  entity: "case" | "batch" | "document" | "task" | "contact" | "lead" | "user";
  entityId: string;
  type: string;
  actorId?: string | null;
  data?: Record<string, unknown>;
}

/** Records an event (F-02). Call it inside the same transaction as the change. */
export async function recordEvent(db: DbOrTx, event: NewEvent) {
  await db.insert(schema.events).values({
    organizationId: event.organizationId,
    entity: event.entity,
    entityId: event.entityId,
    type: event.type,
    actorId: event.actorId ?? null,
    data: event.data ?? {},
  });
}
