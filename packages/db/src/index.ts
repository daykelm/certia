import { fileURLToPath } from "node:url";
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema.js";

export * as schema from "./schema.js";
export * from "./schema.js";
export { sincronizarFichas } from "./sincronizar-fichas.js";

export type Db = NodePgDatabase<typeof schema>;
/** Database or transaction: both can be written to. */
export type DbOTx = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export function crearDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

/**
 * Applies pending migrations. In the Docker image the folder is set with
 * MIGRATIONS_DIR; in development it is resolved relative to this package.
 */
export async function aplicarMigraciones(url = process.env.DATABASE_URL) {
  const carpeta = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../migrations", import.meta.url));
  const { db, pool } = crearDb(url);
  try {
    await migrate(db, { migrationsFolder: carpeta });
  } finally {
    await pool.end();
  }
}

export interface NuevoEvento {
  organizationId: string;
  entidad: "actuacion" | "lote" | "documento" | "tarea" | "contacto" | "lead" | "usuario";
  entidadId: string;
  tipo: string;
  actorId?: string | null;
  datos?: Record<string, unknown>;
}

/** Records an event (F-02). Call it inside the same transaction as the change. */
export async function registrarEvento(db: DbOTx, evento: NuevoEvento) {
  await db.insert(schema.events).values({
    organizationId: evento.organizationId,
    entidad: evento.entidad,
    entidadId: evento.entidadId,
    tipo: evento.tipo,
    actorId: evento.actorId ?? null,
    datos: evento.datos ?? {},
  });
}
