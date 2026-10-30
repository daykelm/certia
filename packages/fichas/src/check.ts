/**
 * Valida todas las fichas y ejecuta sus casos de prueba de cálculo.
 * Se usa en CI: si algo falla, el despliegue se detiene (F-03).
 */
import { claveFicha, ejecutarPruebas } from "@certia/core";
import { cargarCatalogo, directorioFichas } from "./index.js";

let fallos = 0;

try {
  const catalogo = cargarCatalogo();
  console.log(`Fichas en ${directorioFichas()}: ${catalogo.todas().length}\n`);

  for (const ficha of catalogo.todas()) {
    console.log(`${claveFicha(ficha)} · ${ficha.nombre}`);
    for (const p of ejecutarPruebas(ficha)) {
      if (p.ok) {
        console.log(`  ✓ ${p.descripcion} (${p.obtenido} kWh)`);
      } else {
        fallos++;
        const detalle = p.errores?.join("; ") ?? `esperado ${p.esperado}, obtenido ${p.obtenido}`;
        console.log(`  ✗ ${p.descripcion}: ${detalle}`);
      }
    }
  }
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

if (fallos > 0) {
  console.error(`\n${fallos} prueba(s) fallida(s)`);
  process.exit(1);
}
console.log("\nTodas las fichas son válidas.");
