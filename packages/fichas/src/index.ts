import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { claveFicha, FichaSchema, type Ficha } from "@certia/core";

/**
 * Catálogo de fichas cargado desde los YAML de `definiciones/`.
 *
 * En la imagen Docker las apps van empaquetadas, así que la ruta se indica
 * con FICHAS_DIR; en desarrollo se resuelve respecto a este archivo.
 */
export function directorioFichas(): string {
  return process.env.FICHAS_DIR ?? fileURLToPath(new URL("../definiciones", import.meta.url));
}

function listarYaml(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return listarYaml(ruta);
    return /\.ya?ml$/.test(nombre) ? [ruta] : [];
  });
}

export class ErrorFicha extends Error {
  constructor(
    public readonly archivo: string,
    public readonly detalles: string[],
  ) {
    super(`Ficha inválida en ${archivo}:\n  - ${detalles.join("\n  - ")}`);
  }
}

export interface Catalogo {
  todas(): Ficha[];
  obtener(codigo: string, version: number): Ficha | undefined;
  versiones(codigo: string): Ficha[];
  /** Versión vigente en una fecha (AAAA-MM-DD). */
  vigente(codigo: string, fecha: string): Ficha | undefined;
}

export function cargarCatalogo(dir = directorioFichas()): Catalogo {
  const fichas = new Map<string, Ficha>();

  for (const archivo of listarYaml(dir)) {
    const nombre = relative(dir, archivo);
    const r = FichaSchema.safeParse(parse(readFileSync(archivo, "utf8")));
    if (!r.success) {
      throw new ErrorFicha(nombre, r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    }
    const clave = claveFicha(r.data);
    if (fichas.has(clave)) throw new ErrorFicha(nombre, [`${clave} está definida más de una vez`]);
    fichas.set(clave, r.data);
  }

  const todas = [...fichas.values()].sort((a, b) => a.codigo.localeCompare(b.codigo) || a.version - b.version);

  return {
    todas: () => todas,
    obtener: (codigo, version) => fichas.get(claveFicha({ codigo, version })),
    versiones: (codigo) => todas.filter((f) => f.codigo === codigo),
    vigente: (codigo, fecha) =>
      todas
        .filter((f) => f.codigo === codigo && f.vigencia.desde <= fecha && (!f.vigencia.hasta || fecha <= f.vigencia.hasta))
        .at(-1),
  };
}
