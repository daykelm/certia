/**
 * Validates every ficha and runs its calculation test cases.
 * Used in CI: any failure blocks the deployment (F-03).
 */
import { claveFicha, ejecutarPruebas } from "@certia/core";
import { cargarCatalogo, directorioFichas } from "./index.js";

let fallos = 0;

try {
  const catalogo = cargarCatalogo();
  console.log(`Fichas in ${directorioFichas()}: ${catalogo.todas().length}\n`);

  for (const ficha of catalogo.todas()) {
    console.log(`${claveFicha(ficha)} · ${ficha.nombre}`);
    for (const p of ejecutarPruebas(ficha)) {
      if (p.ok) {
        console.log(`  ✓ ${p.descripcion} (${p.obtenido} kWh)`);
      } else {
        fallos++;
        const detalle = p.errores?.join("; ") ?? `expected ${p.esperado}, got ${p.obtenido}`;
        console.log(`  ✗ ${p.descripcion}: ${detalle}`);
      }
    }
  }
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

if (fallos > 0) {
  console.error(`\n${fallos} test(s) failed`);
  process.exit(1);
}
console.log("\nAll fichas are valid.");
