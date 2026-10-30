import { describe, expect, it } from "vitest";
import { ejecutarPruebas } from "@certia/core";
import { cargarCatalogo } from "./index.js";

describe("catálogo de fichas", () => {
  const catalogo = cargarCatalogo();

  it("carga las definiciones y sus pruebas pasan", () => {
    expect(catalogo.todas().length).toBeGreaterThan(0);
    for (const ficha of catalogo.todas()) {
      expect(ejecutarPruebas(ficha).every((p) => p.ok), `${ficha.codigo} v${ficha.version}`).toBe(true);
    }
  });

  it("resuelve la versión vigente por fecha", () => {
    expect(catalogo.vigente("TRA-VE", "2025-06-01")?.version).toBe(1);
    expect(catalogo.vigente("TRA-VE", "2026-03-01")?.version).toBe(2);
  });
});
