import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { claveFicha, type Ficha } from "@certia/core";
import type { Db } from "./index.js";
import { fichaVersions } from "./schema.js";

function hashFicha(ficha: Ficha): string {
  return createHash("sha256").update(JSON.stringify(ficha)).digest("hex");
}

/**
 * Publishes the catalog's fichas to the database.
 * New versions are inserted; if an already published version has changed, it fails:
 * regulatory changes must create a new version (decision D3).
 */
export async function sincronizarFichas(db: Db, fichas: Ficha[]) {
  const resultado = { nuevas: [] as string[], sinCambios: [] as string[] };

  for (const ficha of fichas) {
    const hash = hashFicha(ficha);
    const [existente] = await db
      .select({ hash: fichaVersions.hash })
      .from(fichaVersions)
      .where(and(eq(fichaVersions.codigo, ficha.codigo), eq(fichaVersions.version, ficha.version)));

    if (!existente) {
      await db.insert(fichaVersions).values({
        codigo: ficha.codigo,
        version: ficha.version,
        nombre: ficha.nombre,
        hash,
        definicion: ficha,
      });
      resultado.nuevas.push(claveFicha(ficha));
    } else if (existente.hash !== hash) {
      throw new Error(
        `Ficha ${claveFicha(ficha)} was already published and has changed. Create a new version instead of editing it.`,
      );
    } else {
      resultado.sinCambios.push(claveFicha(ficha));
    }
  }
  return resultado;
}
