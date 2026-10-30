import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Encryptor } from "./encryption.js";

describe("encryption", () => {
  const e = new Encryptor(randomBytes(32).toString("base64"));

  it("encrypts and decrypts", () => {
    const encrypted = e.encrypt("12345678Z");
    expect(encrypted).not.toContain("12345678Z");
    expect(e.decrypt(encrypted)).toBe("12345678Z");
  });

  it("uses a different IV every time", () => {
    expect(e.encrypt("x")).not.toBe(e.encrypt("x"));
  });

  it("search hash ignores formatting", () => {
    expect(e.searchHash("12345678-z")).toBe(e.searchHash("12345678Z"));
  });

  it("detects tampering", () => {
    const parts = e.encrypt("value").split(":");
    parts[3] = Buffer.from("other").toString("base64");
    expect(() => e.decrypt(parts.join(":"))).toThrow();
  });
});
