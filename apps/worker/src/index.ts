import { setTimeout as esperar } from "node:timers/promises";
import { completarTrabajo, crearAdaptadores, fallarTrabajo, reservarTrabajo } from "@certia/adapters";
import { crearDb } from "@certia/db";
import { cargarCatalogo } from "@certia/fichas";
import { manejadores, type ContextoTarea } from "./tareas.js";

const ESPERA_SIN_TRABAJO_MS = 2000;

const { db, pool } = crearDb();
const ctx: ContextoTarea = { db, adaptadores: crearAdaptadores(db), catalogo: cargarCatalogo() };

let activo = true;
const parar = () => {
  console.log("[worker] parando…");
  activo = false;
};
process.on("SIGTERM", parar);
process.on("SIGINT", parar);

console.log(`[worker] en marcha. Tareas registradas: ${Object.keys(manejadores).join(", ")}`);

while (activo) {
  let trabajo;
  try {
    trabajo = await reservarTrabajo(db);
  } catch (e) {
    console.error("[worker] error al leer la cola:", (e as Error).message);
    await esperar(ESPERA_SIN_TRABAJO_MS * 5);
    continue;
  }

  if (!trabajo) {
    await esperar(ESPERA_SIN_TRABAJO_MS);
    continue;
  }

  const manejador = manejadores[trabajo.tipo];
  try {
    if (!manejador) throw new Error(`No hay manejador para "${trabajo.tipo}"`);
    await manejador(trabajo.payload, ctx);
    await completarTrabajo(db, trabajo.id);
  } catch (e) {
    const mensaje = (e as Error).message;
    console.error(`[worker] trabajo ${trabajo.id} (${trabajo.tipo}) falló: ${mensaje}`);
    await fallarTrabajo(db, trabajo, mensaje);
  }
}

await pool.end();
