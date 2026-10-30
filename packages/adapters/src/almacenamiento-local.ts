import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { Almacenamiento } from "./interfaces.js";

/** Disk storage for development. Production uses Cloud Storage. */
export class AlmacenamientoLocal implements Almacenamiento {
  private readonly raiz: string;

  constructor(
    raiz: string,
    private readonly urlBase = "/api/archivos",
  ) {
    this.raiz = resolve(raiz);
  }

  private ruta(relativa: string): string {
    const absoluta = resolve(this.raiz, relativa);
    if (absoluta !== this.raiz && !absoluta.startsWith(this.raiz + sep)) {
      throw new Error("Path outside the storage root");
    }
    return absoluta;
  }

  async guardar(ruta: string, contenido: Buffer) {
    const destino = this.ruta(ruta);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, contenido);
  }

  leer(ruta: string) {
    return readFile(this.ruta(ruta));
  }

  async existe(ruta: string) {
    try {
      await stat(this.ruta(ruta));
      return true;
    } catch {
      return false;
    }
  }

  borrar(ruta: string) {
    return rm(this.ruta(ruta), { force: true });
  }

  async urlTemporal(ruta: string) {
    // No signing locally: the API serves the file after checking the session.
    return `${this.urlBase}/${encodeURI(ruta)}`;
  }
}
