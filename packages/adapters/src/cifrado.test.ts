import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Cifrador } from "./cifrado.js";

describe("cifrado", () => {
  const c = new Cifrador(randomBytes(32).toString("base64"));

  it("cifra y descifra", () => {
    const cifrado = c.cifrar("12345678Z");
    expect(cifrado).not.toContain("12345678Z");
    expect(c.descifrar(cifrado)).toBe("12345678Z");
  });

  it("usa un IV distinto cada vez", () => {
    expect(c.cifrar("x")).not.toBe(c.cifrar("x"));
  });

  it("el hash de búsqueda ignora formato", () => {
    expect(c.hashBusqueda("12345678-z")).toBe(c.hashBusqueda("12345678Z"));
  });

  it("detecta manipulaciones", () => {
    const partes = c.cifrar("dato").split(":");
    partes[3] = Buffer.from("otro").toString("base64");
    expect(() => c.descifrar(partes.join(":"))).toThrow();
  });
});
