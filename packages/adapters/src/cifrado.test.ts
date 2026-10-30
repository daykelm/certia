import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Cifrador } from "./cifrado.js";

describe("encryption", () => {
  const c = new Cifrador(randomBytes(32).toString("base64"));

  it("encrypts and decrypts", () => {
    const cifrado = c.cifrar("12345678Z");
    expect(cifrado).not.toContain("12345678Z");
    expect(c.descifrar(cifrado)).toBe("12345678Z");
  });

  it("uses a different IV every time", () => {
    expect(c.cifrar("x")).not.toBe(c.cifrar("x"));
  });

  it("search hash ignores formatting", () => {
    expect(c.hashBusqueda("12345678-z")).toBe(c.hashBusqueda("12345678Z"));
  });

  it("detects tampering", () => {
    const partes = c.cifrar("dato").split(":");
    partes[3] = Buffer.from("otro").toString("base64");
    expect(() => c.descifrar(partes.join(":"))).toThrow();
  });
});
