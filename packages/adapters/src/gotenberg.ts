import type { PdfConverter } from "./interfaces.js";

/** PDF conversion with Gotenberg (https://gotenberg.dev). */
export class GotenbergConverter implements PdfConverter {
  constructor(private readonly url: string) {}

  private async post(route: string, files: { name: string; content: Buffer }[]): Promise<Buffer> {
    const form = new FormData();
    for (const f of files) form.append("files", new Blob([new Uint8Array(f.content)]), f.name);
    const res = await fetch(`${this.url}${route}`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Gotenberg answered ${res.status}: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }

  toPdf(file: { name: string; content: Buffer }) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (extension === "pdf") return Promise.resolve(file.content);
    // LibreOffice converts both office documents and images.
    return this.post("/forms/libreoffice/convert", [file]).catch((e: Error) => {
      throw new Error(`Could not convert ${file.name}: ${e.message}`);
    });
  }

  merge(pdfs: Buffer[]) {
    return this.post(
      "/forms/pdfengines/merge",
      pdfs.map((content, i) => ({ name: `${String(i).padStart(4, "0")}.pdf`, content })),
    );
  }
}
