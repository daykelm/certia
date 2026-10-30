import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { fichaKey, type Ficha } from "@certia/core";
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
export async function syncFichas(db: Db, fichas: Ficha[]) {
  const result = { added: [] as string[], unchanged: [] as string[] };

  for (const ficha of fichas) {
    const hash = hashFicha(ficha);
    const [existing] = await db
      .select({ hash: fichaVersions.hash })
      .from(fichaVersions)
      .where(and(eq(fichaVersions.code, ficha.code), eq(fichaVersions.version, ficha.version)));

    if (!existing) {
      await db.insert(fichaVersions).values({
        code: ficha.code,
        version: ficha.version,
        name: ficha.name,
        hash,
        definition: ficha,
      });
      result.added.push(fichaKey(ficha));
    } else if (existing.hash !== hash) {
      throw new Error(
        `Ficha ${fichaKey(ficha)} was already published and has changed. Create a new version instead of editing it.`,
      );
    } else {
      result.unchanged.push(fichaKey(ficha));
    }
  }
  return result;
}
