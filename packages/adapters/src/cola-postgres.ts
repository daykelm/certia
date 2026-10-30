import { sql } from "drizzle-orm";
import { jobs, type Db } from "@certia/db";
import type { Cola } from "./interfaces.js";

/** Cola de tareas sobre Postgres. En producción puede sustituirse por Cloud Tasks. */
export class ColaPostgres implements Cola {
  constructor(private readonly db: Db) {}

  async encolar(tipo: string, payload: Record<string, unknown>, opciones?: { retrasoSegundos?: number }) {
    const retraso = opciones?.retrasoSegundos ?? 0;
    await this.db.insert(jobs).values({
      tipo,
      payload,
      ejecutarDesde: sql`now() + make_interval(secs => ${retraso})`,
    });
  }
}

export type Trabajo = {
  id: number;
  tipo: string;
  payload: Record<string, unknown>;
  intentos: number;
};

/**
 * Reserva el siguiente trabajo pendiente. FOR UPDATE SKIP LOCKED permite
 * ejecutar varios workers a la vez sin que dos cojan el mismo trabajo.
 */
export async function reservarTrabajo(db: Db): Promise<Trabajo | undefined> {
  const r = await db.execute<Trabajo>(sql`
    update jobs set estado = 'en_curso', intentos = intentos + 1, updated_at = now()
    where id = (
      select id from jobs
      where estado = 'pendiente' and ejecutar_desde <= now()
      order by ejecutar_desde
      for update skip locked
      limit 1
    )
    returning id, tipo, payload, intentos
  `);
  return r.rows[0];
}

export async function completarTrabajo(db: Db, id: number) {
  await db.execute(sql`update jobs set estado = 'hecho', error = null, updated_at = now() where id = ${id}`);
}

/** Reintenta con espera creciente hasta maxIntentos; después queda en error. */
export async function fallarTrabajo(db: Db, trabajo: Trabajo, error: string, maxIntentos = 5) {
  const definitivo = trabajo.intentos >= maxIntentos;
  const espera = 30 * 2 ** (trabajo.intentos - 1);
  await db.execute(sql`
    update jobs set
      estado = ${definitivo ? "error" : "pendiente"},
      error = ${error},
      ejecutar_desde = now() + make_interval(secs => ${espera}),
      updated_at = now()
    where id = ${trabajo.id}
  `);
}
