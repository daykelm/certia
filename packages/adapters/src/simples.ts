import type { Correo, ExtractorIa } from "./interfaces.js";

/** Extractor vacío: los campos se rellenan a mano hasta conectar la IA (F-05). */
export class ExtractorManual implements ExtractorIa {
  async extraer() {
    return { valores: {}, confianza: {} };
  }
}

/** Correo para desarrollo: escribe el mensaje en la consola. */
export class CorreoConsola implements Correo {
  async enviar(m: { para: string; asunto: string; texto: string }) {
    console.log(`[correo] Para: ${m.para} · ${m.asunto}\n${m.texto}`);
  }
}
