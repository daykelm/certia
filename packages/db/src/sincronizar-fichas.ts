import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { claveFicha, type Ficha } from "@certia/core";
import type { Db } from "./index.js";
import { fichaVersions } from "./schema.js";

function hashFicha(ficha: Ficha): string {
  return createHash("sha256").update(JSON.stringify(ficha)).digest("hex");
}

/**
 * Publica en la base de datos las fichas del catálogo.
 * Las versiones nuevas se insertan; si una versión ya publicada ha cambiado,
 * falla: los cambios normativos deben crear una versión nueva (decisión D3).
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
        `La ficha ${claveFicha(ficha)} ya estaba publicada y ha cambiado. Crea una versión nueva en lugar de modificarla.`,
      );
    } else {
      resultado.sinCambios.push(claveFicha(ficha));
    }
  }
  return resultado;
}
