import { describe, expect, it } from "vitest";
import { ejecutarPruebas } from "@certia/core";
import { cargarCatalogo } from "./index.js";

describe("ficha catalog", () => {
  const catalogo = cargarCatalogo();

  it("loads the definitions and their tests pass", () => {
    expect(catalogo.todas().length).toBeGreaterThan(0);
    for (const ficha of catalogo.todas()) {
      expect(ejecutarPruebas(ficha).every((p) => p.ok), `${ficha.codigo} v${ficha.version}`).toBe(true);
    }
  });

  it("resolves the version in force by date", () => {
    expect(catalogo.vigente("TRA-VE", "2025-06-01")?.version).toBe(1);
    expect(catalogo.vigente("TRA-VE", "2026-03-01")?.version).toBe(2);
  });
});
