import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { fichaKey, FichaSchema, type Ficha } from "@certia/core";

/**
 * Ficha catalog loaded from the YAML files in `definitions/`.
 *
 * In the Docker image the apps are bundled, so the path is set with FICHAS_DIR;
 * in development it is resolved relative to this file.
 */
export function fichasDir(): string {
  return process.env.FICHAS_DIR ?? fileURLToPath(new URL("../definitions", import.meta.url));
}

function listYamlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listYamlFiles(path);
    return /\.ya?ml$/.test(name) ? [path] : [];
  });
}

export class FichaError extends Error {
  constructor(
    public readonly file: string,
    public readonly details: string[],
  ) {
    super(`Invalid ficha in ${file}:\n  - ${details.join("\n  - ")}`);
  }
}

export interface Catalog {
  all(): Ficha[];
  get(code: string, version: number): Ficha | undefined;
  versions(code: string): Ficha[];
  /** Version in force on a date (YYYY-MM-DD). */
  inForce(code: string, date: string): Ficha | undefined;
}

export function loadCatalog(dir = fichasDir()): Catalog {
  const fichas = new Map<string, Ficha>();

  for (const file of listYamlFiles(dir)) {
    const name = relative(dir, file);
    let raw: unknown;
    try {
      raw = parse(readFileSync(file, "utf8"));
    } catch (e) {
      throw new FichaError(name, [(e as Error).message]);
    }
    const r = FichaSchema.safeParse(raw);
    if (!r.success) throw new FichaError(name, r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    const key = fichaKey(r.data);
    if (fichas.has(key)) throw new FichaError(name, [`${key} is defined more than once`]);
    fichas.set(key, r.data);
  }

  const all = [...fichas.values()].sort((a, b) => a.code.localeCompare(b.code) || a.version - b.version);

  return {
    all: () => all,
    get: (code, version) => fichas.get(fichaKey({ code, version })),
    versions: (code) => all.filter((f) => f.code === code),
    inForce: (code, date) =>
      all
        .filter((f) => f.code === code && f.validity.from <= date && (!f.validity.to || date <= f.validity.to))
        .at(-1),
  };
}
