/**
 * Validates every measure and runs its calculation test cases.
 * Used in CI: any failure blocks the deployment (F-03).
 */
import { measureKey, runTests } from "@certia/core";
import { loadCatalog, measuresDir } from "./index.js";

let failures = 0;

try {
  const catalog = loadCatalog();
  console.log(`Measures in ${measuresDir()}: ${catalog.all().length}\n`);

  for (const measure of catalog.all()) {
    console.log(`${measureKey(measure)} · ${measure.name}`);
    for (const t of runTests(measure)) {
      if (t.ok) {
        console.log(`  ✓ ${t.description} (${t.actual} kWh)`);
      } else {
        failures++;
        console.log(`  ✗ ${t.description}: ${t.errors?.join("; ") ?? `expected ${t.expected}, got ${t.actual}`}`);
      }
    }
  }
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll measures are valid.");
