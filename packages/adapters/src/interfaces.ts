/**
 * Infrastructure ports (decision D6).
 * The domain and the apps depend on these interfaces, never on a specific provider.
 */

export interface Almacenamiento {
  guardar(ruta: string, contenido: Buffer, tipoMime?: string): Promise<void>;
  leer(ruta: string): Promise<Buffer>;
  existe(ruta: string): Promise<boolean>;
  borrar(ruta: string): Promise<void>;
  /** Temporary download link (F-06, F-16). */
  urlTemporal(ruta: string, segundos: number): Promise<string>;
}

export interface Cola {
  encolar(tipo: string, payload: Record<string, unknown>, opciones?: { retrasoSegundos?: number }): Promise<void>;
}

export interface ConversorPdf {
  /** Converts images and office documents to PDF. */
  aPdf(archivo: { nombre: string; contenido: Buffer }): Promise<Buffer>;
  /** Merges several PDFs into one. */
  unir(pdfs: Buffer[]): Promise<Buffer>;
}

export interface CampoExtraer {
  id: string;
  etiqueta: string;
  tipo: string;
  opciones?: string[];
}

export interface ResultadoExtraccion {
  tipoDocumento?: string;
  valores: Record<string, unknown>;
  /** Confidence 0–1 per field. */
  confianza: Record<string, number>;
}

export interface ExtractorIa {
  extraer(entrada: {
    documento: Buffer;
    mime: string;
    tiposPosibles: string[];
    campos: CampoExtraer[];
  }): Promise<ResultadoExtraccion>;
}

export interface Correo {
  enviar(mensaje: { para: string; asunto: string; texto: string; html?: string }): Promise<void>;
}
