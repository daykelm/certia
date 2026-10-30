import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Cifrado de datos sensibles a nivel de aplicación (F-16).
 *
 * AES-256-GCM con IV aleatorio. El formato guardado es `v1:<iv>:<tag>:<datos>` en base64.
 * En producción la clave procederá de Cloud KMS (cifrado de sobre); la interfaz no cambia.
 */
export class Cifrador {
  private readonly clave: Buffer;
  private readonly claveHash: Buffer;

  constructor(claveBase64: string) {
    const clave = Buffer.from(claveBase64, "base64");
    if (clave.length !== 32) throw new Error("La clave de cifrado debe tener 32 bytes (base64)");
    this.clave = clave;
    // Clave derivada distinta para los hashes de búsqueda.
    this.claveHash = createHmac("sha256", clave).update("certia:busqueda").digest();
  }

  static desdeEntorno(): Cifrador {
    const clave = process.env.ENCRYPTION_KEY;
    if (!clave) throw new Error("Falta ENCRYPTION_KEY");
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
    if (version !== "v1" || !iv || !tag || !datos) throw new Error("Formato de dato cifrado no válido");
    const decipher = createDecipheriv("aes-256-gcm", this.clave, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(datos, "base64")), decipher.final()]).toString("utf8");
  }

  /** Hash determinista para buscar (p. ej. por DNI) sin guardar el valor en claro. */
  hashBusqueda(texto: string): string {
    const normalizado = texto.replace(/[\s-]/g, "").toUpperCase();
    return createHmac("sha256", this.claveHash).update(normalizado).digest("hex");
  }
}
