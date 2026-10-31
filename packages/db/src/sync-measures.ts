import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { measureKey, type Measure } from "@certia/core";
import type { Db } from "./index.js";
import { measureVersions } from "./schema.js";

function hashMeasure(measure: Measure): string {
  return createHash("sha256").update(JSON.stringify(measure)).digest("hex");
}

/**
 * Publishes the catalog's measures to the database.
 * New versions are inserted; if an already published version has changed, it fails:
 * regulatory changes must create a new version (decision D3).
 */
export async function syncMeasures(db: Db, measures: Measure[]) {
  const result = { added: [] as string[], unchanged: [] as string[] };

  for (const measure of measures) {
    const hash = hashMeasure(measure);
    const [existing] = await db
      .select({ hash: measureVersions.hash })
      .from(measureVersions)
      .where(and(eq(measureVersions.code, measure.code), eq(measureVersions.version, measure.version)));

    if (!existing) {
      await db.insert(measureVersions).values({
        code: measure.code,
        version: measure.version,
        name: measure.name,
        hash,
        definition: measure,
      });
      result.added.push(measureKey(measure));
    } else if (existing.hash !== hash) {
      throw new Error(
        `Measure ${measureKey(measure)} was already published and has changed. Create a new version instead of editing it.`,
      );
    } else {
      result.unchanged.push(measureKey(measure));
    }
  }
  return result;
}
