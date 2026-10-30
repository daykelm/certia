/**
 * Infrastructure ports (decision D6).
 * The domain and the apps depend on these interfaces, never on a specific provider.
 */

export interface Storage {
  put(path: string, content: Buffer, mimeType?: string): Promise<void>;
  get(path: string): Promise<Buffer>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  /** Temporary download link (F-06, F-16). */
  temporaryUrl(path: string, seconds: number): Promise<string>;
}

export interface Queue {
  enqueue(type: string, payload: Record<string, unknown>, options?: { delaySeconds?: number }): Promise<void>;
}

export interface PdfConverter {
  /** Converts images and office documents to PDF. */
  toPdf(file: { name: string; content: Buffer }): Promise<Buffer>;
  /** Merges several PDFs into one. */
  merge(pdfs: Buffer[]): Promise<Buffer>;
}

export interface ExtractionField {
  id: string;
  label: string;
  type: string;
  options?: string[];
}

export interface ExtractionResult {
  documentType?: string;
  values: Record<string, unknown>;
  /** Confidence 0–1 per field. */
  confidence: Record<string, number>;
}

export interface AiExtractor {
  extract(input: {
    document: Buffer;
    mime: string;
    possibleTypes: string[];
    fields: ExtractionField[];
  }): Promise<ExtractionResult>;
}

export interface Mailer {
  send(message: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}
