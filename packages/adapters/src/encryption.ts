import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Application-level encryption of sensitive data (F-16).
 *
 * AES-256-GCM with a random IV. Stored format: `v1:<iv>:<tag>:<data>`, base64-encoded.
 * In production the key will come from Cloud KMS (envelope encryption); the interface stays the same.
 */
export class Encryptor {
  private readonly key: Buffer;
  private readonly hashKey: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== 32) throw new Error("The encryption key must be 32 bytes (base64)");
    this.key = key;
    // Separate derived key for search hashes.
    this.hashKey = createHmac("sha256", key).update("certia:search").digest();
  }

  static fromEnv(): Encryptor {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) throw new Error("ENCRYPTION_KEY is not set");
    return new Encryptor(key);
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ["v1", iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
  }

  decrypt(value: string): string {
    const [version, iv, tag, data] = value.split(":");
    if (version !== "v1" || !iv || !tag || !data) throw new Error("Invalid encrypted value format");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  }

  /** Deterministic hash to search (e.g. by DNI) without storing the plain value. */
  searchHash(plain: string): string {
    const normalized = plain.replace(/[\s-]/g, "").toUpperCase();
    return createHmac("sha256", this.hashKey).update(normalized).digest("hex");
  }
}
