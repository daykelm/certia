import type { ConversorPdf } from "./interfaces.js";

/** Conversión a PDF con Gotenberg (https://gotenberg.dev). */
export class ConversorGotenberg implements ConversorPdf {
  constructor(private readonly url: string) {}

  private async enviar(ruta: string, archivos: { nombre: string; contenido: Buffer }[]): Promise<Buffer> {
    const form = new FormData();
    for (const a of archivos) form.append("files", new Blob([new Uint8Array(a.contenido)]), a.nombre);
    const res = await fetch(`${this.url}${ruta}`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Gotenberg respondió ${res.status}: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }

  aPdf(archivo: { nombre: string; contenido: Buffer }) {
    const extension = archivo.nombre.split(".").pop()?.toLowerCase() ?? "";
    if (extension === "pdf") return Promise.resolve(archivo.contenido);
    const esImagen = ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp"].includes(extension);
    // LibreOffice convierte tanto documentos ofimáticos como imágenes.
    return this.enviar("/forms/libreoffice/convert", [archivo]).catch((e) => {
      throw new Error(`No se pudo convertir ${esImagen ? "la imagen" : "el documento"} ${archivo.nombre}: ${e.message}`);
    });
  }

  unir(pdfs: Buffer[]) {
    return this.enviar(
      "/forms/pdfengines/merge",
      pdfs.map((contenido, i) => ({ nombre: `${String(i).padStart(4, "0")}.pdf`, contenido })),
    );
  }
}
