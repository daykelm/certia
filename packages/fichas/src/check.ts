/**
 * Validates every ficha and runs its calculation test cases.
 * Used in CI: any failure blocks the deployment (F-03).
 */
import { fichaKey, runTests } from "@certia/core";
import { fichasDir, loadCatalog } from "./index.js";

let failures = 0;

try {
  const catalog = loadCatalog();
  console.log(`Fichas in ${fichasDir()}: ${catalog.all().length}\n`);

  for (const ficha of catalog.all()) {
    console.log(`${fichaKey(ficha)} · ${ficha.name}`);
    for (const t of runTests(ficha)) {
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
console.log("\nAll fichas are valid.");
