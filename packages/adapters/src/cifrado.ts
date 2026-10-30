import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Application-level encryption of sensitive data (F-16).
 *
 * AES-256-GCM with a random IV. Stored format: `v1:<iv>:<tag>:<data>`, base64-encoded.
 * In production the key will come from Cloud KMS (envelope encryption); the interface stays the same.
 */
export class Cifrador {
  private readonly clave: Buffer;
  private readonly claveHash: Buffer;

  constructor(claveBase64: string) {
    const clave = Buffer.from(claveBase64, "base64");
    if (clave.length !== 32) throw new Error("The encryption key must be 32 bytes (base64)");
    this.clave = clave;
    // Separate derived key for search hashes.
    this.claveHash = createHmac("sha256", clave).update("certia:busqueda").digest();
  }

  static desdeEntorno(): Cifrador {
    const clave = process.env.ENCRYPTION_KEY;
    if (!clave) throw new Error("ENCRYPTION_KEY is not set");
    return new Cifrador(clave);
  }

  cifrar(texto: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.clave, iv);
    const datos = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ["v1", iv.toString("base64"), tag.toString("base64"), datos.toString("base64")].join(":");
  }

  descifrar(valor: string): string {
    const [version, iv, tag, datos] = valor.split(":");
    if (version !== "v1" || !iv || !tag || !datos) throw new Error("Invalid encrypted value format");
    const decipher = createDecipheriv("aes-256-gcm", this.clave, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(datos, "base64")), decipher.final()]).toString("utf8");
  }

  /** Deterministic hash to search (e.g. by DNI) without storing the plain value. */
  hashBusqueda(texto: string): string {
    const normalizado = texto.replace(/[\s-]/g, "").toUpperCase();
    return createHmac("sha256", this.claveHash).update(normalizado).digest("hex");
  }
}
