import { crearAdaptadores } from "@certia/adapters";
import { crearDb } from "@certia/db";
import { cargarCatalogo } from "@certia/fichas";
import { construirApp } from "./app.js";

const { db, pool } = crearDb();
const catalogo = cargarCatalogo();
const app = await construirApp(
  { db, catalogo, adaptadores: crearAdaptadores(db) },
  { webDir: process.env.WEB_DIR },
);

const cerrar = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", cerrar);
process.on("SIGINT", cerrar);

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
