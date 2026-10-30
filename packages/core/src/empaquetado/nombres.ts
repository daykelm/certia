import type { Empaquetado } from "../ficha/schema.js";

/**
 * File names and sizes for the verification and issuance packages (F-06, F-11).
 */

/** Turns free text into a safe file name (no accents, spaces or forbidden characters). */
export function normalizarNombre(texto: string, reglas: Pick<Empaquetado, "caracteres_prohibidos">): string {
  const prohibidos = new Set(reglas.caracteres_prohibidos);
  const sinAcentos = texto.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  let resultado = "";
  for (const ch of sinAcentos) {
    resultado += prohibidos.has(ch) || /\s/.test(ch) ? "_" : ch;
  }
  return resultado.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/** Fills a pattern such as "{referencia}_{tipo}" and normalizes it. */
export function generarNombre(
  patron: string,
  variables: Record<string, string | number>,
  reglas: Pick<Empaquetado, "caracteres_prohibidos">,
): string {
  const relleno = patron.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = variables[k];
    if (v === undefined) throw new Error(`Falta la variable "${k}" para el nombre de archivo`);
    return normalizarNombre(String(v), reglas);
  });
  return normalizarNombre(relleno, reglas);
}

export interface ArchivoPaquete {
  /** Name without extension. */
  nombre: string;
  extension: string;
  bytes: number;
}

/** Returns the file's list of errors; empty when valid. */
export function validarArchivo(archivo: ArchivoPaquete, reglas: Empaquetado): string[] {
  const errores: string[] = [];
  const completo = `${archivo.nombre}.${archivo.extension}`;

  const prohibidos = [...new Set([...archivo.nombre].filter((ch) => reglas.caracteres_prohibidos.includes(ch)))];
  if (prohibidos.length > 0) {
    errores.push(`${completo}: contiene caracteres no permitidos (${prohibidos.join(" ")})`);
  }
  if (/\s/.test(archivo.nombre)) errores.push(`${completo}: contiene espacios`);
  if (completo.length > reglas.longitud_max_nombre) {
    errores.push(`${completo}: el nombre supera ${reglas.longitud_max_nombre} caracteres`);
  }
  const maxBytes = reglas.tamano_max_mb * 1024 * 1024;
  if (archivo.bytes > maxBytes) {
    const mb = (archivo.bytes / 1024 / 1024).toFixed(1);
    errores.push(`${completo}: pesa ${mb} MB y el máximo es ${reglas.tamano_max_mb} MB`);
  }
  return errores;
}
