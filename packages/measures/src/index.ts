import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { measureKey, MeasureSchema, type Measure } from "@certia/core";

/**
 * Measure catalog loaded from the YAML files in `definitions/`.
 *
 * In the Docker image the apps are bundled, so the path is set with MEASURES_DIR;
 * in development it is resolved relative to this file.
 */
export function measuresDir(): string {
  return process.env.MEASURES_DIR ?? fileURLToPath(new URL("../definitions", import.meta.url));
}

function listYamlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listYamlFiles(path);
    return /\.ya?ml$/.test(name) ? [path] : [];
  });
}

export class MeasureError extends Error {
  constructor(
    public readonly file: string,
    public readonly details: string[],
  ) {
    super(`Invalid measure in ${file}:\n  - ${details.join("\n  - ")}`);
  }
}

export interface Catalog {
  all(): Measure[];
  get(code: string, version: number): Measure | undefined;
  versions(code: string): Measure[];
  /** Version in force on a date (YYYY-MM-DD). */
  inForce(code: string, date: string): Measure | undefined;
}

export function loadCatalog(dir = measuresDir()): Catalog {
  const measures = new Map<string, Measure>();

  for (const file of listYamlFiles(dir)) {
    const name = relative(dir, file);
    let raw: unknown;
    try {
      raw = parse(readFileSync(file, "utf8"));
    } catch (e) {
      throw new MeasureError(name, [(e as Error).message]);
    }
    const r = MeasureSchema.safeParse(raw);
    if (!r.success) throw new MeasureError(name, r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    const key = measureKey(r.data);
    if (measures.has(key)) throw new MeasureError(name, [`${key} is defined more than once`]);
    measures.set(key, r.data);
  }

  const all = [...measures.values()].sort((a, b) => a.code.localeCompare(b.code) || a.version - b.version);

  return {
    all: () => all,
    get: (code, version) => measures.get(measureKey({ code, version })),
    versions: (code) => all.filter((m) => m.code === code),
    inForce: (code, date) =>
      all
        .filter((m) => m.code === code && m.validity.from <= date && (!m.validity.to || date <= m.validity.to))
        .at(-1),
  };
}
