import { describe, expect, it } from "vitest";
import { runTests } from "@certia/core";
import { loadCatalog } from "./index.js";

describe("measure catalog", () => {
  const catalog = loadCatalog();

  it("loads the definitions and their tests pass", () => {
    expect(catalog.all().length).toBeGreaterThan(0);
    for (const measure of catalog.all()) {
      expect(runTests(measure).every((t) => t.ok), `${measure.code} v${measure.version}`).toBe(true);
    }
  });

  it("resolves the version in force by date", () => {
    expect(catalog.inForce("TRA-VE", "2025-06-01")?.version).toBe(1);
    expect(catalog.inForce("TRA-VE", "2026-03-01")?.version).toBe(2);
  });
});
