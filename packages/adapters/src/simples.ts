import type { Correo, ExtractorIa } from "./interfaces.js";

/** No-op extractor: fields are filled in by hand until AI is connected (F-05). */
export class ExtractorManual implements ExtractorIa {
  async extraer() {
    return { valores: {}, confianza: {} };
  }
}

/** Development mailer: prints the message to the console. */
export class CorreoConsola implements Correo {
  async enviar(m: { para: string; asunto: string; texto: string }) {
    console.log(`[mail] To: ${m.para} · ${m.asunto}\n${m.texto}`);
  }
}
