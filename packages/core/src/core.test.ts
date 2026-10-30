import { describe, expect, it } from "vitest";
import {
  buildChecklist,
  buildFileName,
  calculateSavings,
  canTransition,
  canTransitionLote,
  compareVersions,
  evaluateExpression,
  parseFicha,
  proposeLotes,
  runTests,
  validateFile,
  type FichaInput,
} from "./index.js";

const base: FichaInput = {
  code: "TEST-VE",
  version: 1,
  name: "Test ficha",
  validity: { from: "2024-01-01" },
  fields: [
    { id: "tipo_vehiculo", label: "Tipo", type: "enum", options: ["M1", "N1"] },
    { id: "achatarramiento", label: "Achatarramiento", type: "boolean" },
    { id: "comunidad", label: "CCAA", type: "region" },
  ],
  constants: { ahorro_anual: { M1: 600, N1: 900 }, vida_util: 10 },
  calculation: { formula: "ahorro_anual[tipo_vehiculo] * vida_util" },
  tests: [{ input: { tipo_vehiculo: "M1", achatarramiento: false, comunidad: "01-andalucia" }, expected_kwh: 6000 }],
  documents: [
    { type: "ficha_tecnica", label: "Ficha técnica" },
    { type: "baja_vehiculo", label: "Baja del vehículo antiguo", condition: "achatarramiento" },
    { type: "acuerdo_cesion", label: "Acuerdo de cesión", generated: true },
  ],
  grouping: { required: true, keys: ["region", "year"], min_kwh: 30000 },
};

const v1 = parseFicha(base);
const v2 = parseFicha({
  ...base,
  version: 2,
  constants: { ...base.constants, factor_achatarramiento: 1.2 },
  calculation: { formula: "ahorro_anual[tipo_vehiculo] * vida_util * (achatarramiento ? factor_achatarramiento : 1)" },
  tests: [{ input: { tipo_vehiculo: "N1", achatarramiento: true, comunidad: "13-madrid" }, expected_kwh: 10800 }],
  documents: [...(base.documents ?? []), { type: "certificado_eficiencia", label: "Certificado" }],
});

describe("fichas", () => {
  it("applies defaults", () => {
    expect(v1.packaging.max_size_mb).toBe(10);
    expect(v1.fields[0]?.required).toBe(true);
  });

  it("rejects fichas without tests or with duplicate fields", () => {
    expect(() => parseFicha({ ...base, tests: [] })).toThrow();
    expect(() => parseFicha({ ...base, fields: [...base.fields, base.fields[0]!] })).toThrow();
  });

  it("rejects enums without options", () => {
    expect(() => parseFicha({ ...base, fields: [{ id: "x", label: "X", type: "enum" }] })).toThrow();
  });
});

describe("calculation", () => {
  it("calculates with constant lookup tables", () => {
    const r = calculateSavings(v1, { tipo_vehiculo: "N1", achatarramiento: false, comunidad: "13-madrid" });
    expect(r).toMatchObject({ ok: true, kwh: 9000 });
  });

  it("validates data before calculating", () => {
    const r = calculateSavings(v1, { tipo_vehiculo: "X", comunidad: "13-madrid" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("ficha test cases pass", () => {
    expect(runTests(v1).every((t) => t.ok)).toBe(true);
    expect(runTests(v2).every((t) => t.ok)).toBe(true);
  });

  it("blocks dangerous functions in formulas", () => {
    expect(() => evaluateExpression("import({}, {})", {})).toThrow();
    expect(() => evaluateExpression('evaluate("1+1")', {})).toThrow();
  });
});

describe("version comparator", () => {
  it("picks the version with the highest savings and lists exclusive documents", () => {
    const c = compareVersions([v1, v2], { tipo_vehiculo: "M1", achatarramiento: true, comunidad: "13-madrid" });
    expect(c.best).toEqual({ code: "TEST-VE", version: 2, kwh: 7200 });
    expect(c.versions[1]?.exclusiveDocuments).toEqual(["certificado_eficiencia"]);
  });
});

describe("checklist", () => {
  it("applies conditional documents", () => {
    expect(buildChecklist(v1, { achatarramiento: false }, []).missing).toEqual(["ficha_tecnica", "acuerdo_cesion"]);
    const withScrappage = buildChecklist(v1, { achatarramiento: true }, [{ type: "ficha_tecnica", status: "validated" }]);
    expect(withScrappage.missing).toEqual(["baja_vehiculo", "acuerdo_cesion"]);
  });

  it("is complete when every required document is validated", () => {
    const c = buildChecklist(v1, { achatarramiento: false }, [
      { type: "ficha_tecnica", status: "rejected" },
      { type: "ficha_tecnica", status: "validated" },
      { type: "acuerdo_cesion", status: "validated" },
    ]);
    expect(c.complete).toBe(true);
  });
});

describe("expediente workflow", () => {
  const ctx = { checklistComplete: true, savingsCalculated: true, origin: "user" as const };

  it("allows valid transitions", () => {
    expect(canTransition("pending_review", "complete", ctx).ok).toBe(true);
  });

  it("explains why it cannot be completed", () => {
    const r = canTransition("pending_review", "complete", { ...ctx, checklistComplete: false });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("Faltan documentos obligatorios por validar");
  });

  it("lote-driven states cannot be changed by hand", () => {
    expect(canTransition("complete", "in_lote", ctx).ok).toBe(false);
    expect(canTransition("complete", "in_lote", { ...ctx, origin: "lote" }).ok).toBe(true);
  });

  it("rejects undefined transitions", () => {
    expect(canTransition("lead", "issued", ctx).ok).toBe(false);
  });
});

describe("lote workflow", () => {
  it("cannot be prepared below the minimum", () => {
    const r = canTransitionLote("draft", "ready_for_verification", { meetsMinimum: false, expedienteCount: 3, openTasks: 0 });
    expect(r.ok).toBe(false);
  });
});

describe("lote proposals", () => {
  it("groups by keys and computes what is missing", () => {
    const expediente = (id: string, status: "complete" | "incomplete", region: string, kwh = 6000) => ({
      id,
      status,
      savingsKwh: kwh,
      values: { region, year: 2025 },
    });
    const proposals = proposeLotes(
      [
        ...["a", "b", "c", "d", "e"].map((id) => expediente(id, "complete", "01-andalucia")),
        expediente("f", "complete", "13-madrid"),
        expediente("g", "incomplete", "13-madrid"),
      ],
      v1.grouping,
    );
    expect(proposals[0]).toMatchObject({ label: "01-andalucia · 2025", totalKwh: 30000, meetsMinimum: true });
    expect(proposals[1]).toMatchObject({ totalKwh: 6000, missingKwh: 24000, candidates: ["g"], potentialKwh: 12000 });
  });
});

describe("file names", () => {
  it("normalizes accents and forbidden characters", () => {
    expect(buildFileName("{reference}_{type}", { reference: "AND 2025.03", type: "Ficha técnica" }, v1.packaging)).toBe(
      "AND_2025_03_Ficha_tecnica",
    );
  });

  it("detects invalid names and sizes", () => {
    const errors = validateFile({ name: "mal nombre.v2", extension: "pdf", bytes: 12 * 1024 * 1024 }, v1.packaging);
    expect(errors).toHaveLength(3);
  });
});
