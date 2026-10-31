import { describe, expect, it } from "vitest";
import {
  buildChecklist,
  buildFileName,
  calculateSavings,
  canTransition,
  canTransitionBatch,
  compareVersions,
  evaluateExpression,
  parseMeasure,
  proposeBatches,
  runTests,
  validateFile,
  type MeasureInput,
} from "./index.js";

const base: MeasureInput = {
  code: "TEST-EV",
  version: 1,
  name: "Test measure",
  validity: { from: "2024-01-01" },
  fields: [
    { id: "vehicle_type", label: "Vehicle type", type: "enum", options: ["M1", "N1"] },
    { id: "scrapped_vehicle", label: "Scrapped vehicle", type: "boolean" },
    { id: "region", label: "Region", type: "region" },
  ],
  constants: { annual_savings: { M1: 600, N1: 900 }, lifetime: 10 },
  calculation: { formula: "annual_savings[vehicle_type] * lifetime" },
  tests: [{ input: { vehicle_type: "M1", scrapped_vehicle: false, region: "01-andalucia" }, expected_kwh: 6000 }],
  documents: [
    { type: "technical_sheet", label: "Technical sheet" },
    { type: "deregistration", label: "Deregistration of the old vehicle", condition: "scrapped_vehicle" },
    { type: "assignment_agreement", label: "Savings assignment agreement", generated: true },
  ],
  grouping: { required: true, keys: ["region", "year"], min_kwh: 30000 },
};

const v1 = parseMeasure(base);
const v2 = parseMeasure({
  ...base,
  version: 2,
  constants: { ...base.constants, scrappage_factor: 1.2 },
  calculation: { formula: "annual_savings[vehicle_type] * lifetime * (scrapped_vehicle ? scrappage_factor : 1)" },
  tests: [{ input: { vehicle_type: "N1", scrapped_vehicle: true, region: "13-madrid" }, expected_kwh: 10800 }],
  documents: [...(base.documents ?? []), { type: "efficiency_certificate", label: "Certificate" }],
});

describe("measures", () => {
  it("applies defaults", () => {
    expect(v1.packaging.max_size_mb).toBe(10);
    expect(v1.fields[0]?.required).toBe(true);
  });

  it("rejects measures without tests or with duplicate fields", () => {
    expect(() => parseMeasure({ ...base, tests: [] })).toThrow();
    expect(() => parseMeasure({ ...base, fields: [...base.fields, base.fields[0]!] })).toThrow();
  });

  it("rejects enums without options", () => {
    expect(() => parseMeasure({ ...base, fields: [{ id: "x", label: "X", type: "enum" }] })).toThrow();
  });
});

describe("calculation", () => {
  it("calculates with constant lookup tables", () => {
    const r = calculateSavings(v1, { vehicle_type: "N1", scrapped_vehicle: false, region: "13-madrid" });
    expect(r).toMatchObject({ ok: true, kwh: 9000 });
  });

  it("validates data before calculating", () => {
    const r = calculateSavings(v1, { vehicle_type: "X", region: "13-madrid" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("measure test cases pass", () => {
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
    const c = compareVersions([v1, v2], { vehicle_type: "M1", scrapped_vehicle: true, region: "13-madrid" });
    expect(c.best).toEqual({ code: "TEST-EV", version: 2, kwh: 7200 });
    expect(c.versions[1]?.exclusiveDocuments).toEqual(["efficiency_certificate"]);
  });
});

describe("checklist", () => {
  it("applies conditional documents", () => {
    expect(buildChecklist(v1, { scrapped_vehicle: false }, []).missing).toEqual(["technical_sheet", "assignment_agreement"]);
    const withScrappage = buildChecklist(v1, { scrapped_vehicle: true }, [{ type: "technical_sheet", status: "validated" }]);
    expect(withScrappage.missing).toEqual(["deregistration", "assignment_agreement"]);
  });

  it("is complete when every required document is validated", () => {
    const c = buildChecklist(v1, { scrapped_vehicle: false }, [
      { type: "technical_sheet", status: "rejected" },
      { type: "technical_sheet", status: "validated" },
      { type: "assignment_agreement", status: "validated" },
    ]);
    expect(c.complete).toBe(true);
  });
});

describe("case workflow", () => {
  const ctx = { checklistComplete: true, savingsCalculated: true, origin: "user" as const };

  it("allows valid transitions", () => {
    expect(canTransition("pending_review", "complete", ctx).ok).toBe(true);
  });

  it("explains why it cannot be completed", () => {
    const r = canTransition("pending_review", "complete", { ...ctx, checklistComplete: false });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("Required documents are still pending validation");
  });

  it("batch-driven states cannot be changed by hand", () => {
    expect(canTransition("complete", "in_batch", ctx).ok).toBe(false);
    expect(canTransition("complete", "in_batch", { ...ctx, origin: "batch" }).ok).toBe(true);
  });

  it("rejects undefined transitions", () => {
    expect(canTransition("lead", "issued", ctx).ok).toBe(false);
  });
});

describe("batch workflow", () => {
  it("cannot be prepared below the minimum", () => {
    const r = canTransitionBatch("draft", "ready_for_verification", { meetsMinimum: false, caseCount: 3, openTasks: 0 });
    expect(r.ok).toBe(false);
  });
});

describe("batch proposals", () => {
  it("groups by keys and computes what is missing", () => {
    const sampleCase = (id: string, status: "complete" | "incomplete", region: string, kwh = 6000) => ({
      id,
      status,
      savingsKwh: kwh,
      values: { region, year: 2025 },
    });
    const proposals = proposeBatches(
      [
        ...["a", "b", "c", "d", "e"].map((id) => sampleCase(id, "complete", "01-andalucia")),
        sampleCase("f", "complete", "13-madrid"),
        sampleCase("g", "incomplete", "13-madrid"),
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
    const errors = validateFile({ name: "bad name.v2", extension: "pdf", bytes: 12 * 1024 * 1024 }, v1.packaging);
    expect(errors).toHaveLength(3);
  });
});
