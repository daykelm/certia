/**
 * Puertos de infraestructura (decisión D6).
 * El dominio y las apps dependen de estas interfaces, nunca de un proveedor concreto.
 */

export interface Almacenamiento {
  guardar(ruta: string, contenido: Buffer, tipoMime?: string): Promise<void>;
  leer(ruta: string): Promise<Buffer>;
  existe(ruta: string): Promise<boolean>;
  borrar(ruta: string): Promise<void>;
  /** Enlace temporal de descarga (F-06, F-16). */
  urlTemporal(ruta: string, segundos: number): Promise<string>;
}

export interface Cola {
  encolar(tipo: string, payload: Record<string, unknown>, opciones?: { retrasoSegundos?: number }): Promise<void>;
}

export interface ConversorPdf {
  /** Convierte imágenes y documentos ofimáticos a PDF. */
  aPdf(archivo: { nombre: string; contenido: Buffer }): Promise<Buffer>;
  /** Une varios PDF en uno. */
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
  /** Confianza 0–1 por campo. */
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
