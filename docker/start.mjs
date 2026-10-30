// Punto de entrada de la imagen: arranca la API, el worker o las migraciones según APP_MODE.
const entradas = {
  api: "./apps/api/dist/index.js",
  worker: "./apps/worker/dist/index.js",
  migrate: "./apps/api/dist/migrate.js",
};

const modo = process.env.APP_MODE ?? "api";
const entrada = entradas[modo];
if (!entrada) {
  console.error(`APP_MODE no válido: "${modo}". Usa: ${Object.keys(entradas).join(", ")}`);
  process.exit(1);
}
await import(entrada);
