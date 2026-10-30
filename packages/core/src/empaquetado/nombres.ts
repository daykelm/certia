import type { Empaquetado } from "../ficha/schema.js";

/**
 * Nombres y tamaños de archivo para los paquetes de verificación y emisión (F-06, F-11).
 */

/** Convierte un texto libre en un nombre de archivo seguro (sin acentos, espacios ni caracteres prohibidos). */
export function normalizarNombre(texto: string, reglas: Pick<Empaquetado, "caracteres_prohibidos">): string {
  const prohibidos = new Set(reglas.caracteres_prohibidos);
  const sinAcentos = texto.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  let resultado = "";
  for (const ch of sinAcentos) {
    resultado += prohibidos.has(ch) || /\s/.test(ch) ? "_" : ch;
  }
  return resultado.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/** Rellena un patrón como "{referencia}_{tipo}" y lo normaliza. */
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
  /** Nombre sin extensión. */
  nombre: string;
  extension: string;
  bytes: number;
}

/** Devuelve la lista de errores de un archivo; vacía si es válido. */
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
