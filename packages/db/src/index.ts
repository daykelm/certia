import { fileURLToPath } from "node:url";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema.js";

export * as schema from "./schema.js";
export * from "./schema.js";
export { sincronizarFichas } from "./sincronizar-fichas.js";

export type Db = NodePgDatabase<typeof schema>;
/** Base de datos o transacción: ambas sirven para escribir. */
export type DbOTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export function crearDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("Falta DATABASE_URL");
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

/**
 * Aplica las migraciones pendientes. En la imagen Docker la carpeta se indica
 * con MIGRATIONS_DIR; en desarrollo se resuelve respecto a este paquete.
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

/** Registra un evento (F-02). Úsalo dentro de la misma transacción que el cambio. */
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
