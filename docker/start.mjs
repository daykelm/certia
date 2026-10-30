// Image entrypoint: starts the API, the worker or the migrations depending on APP_MODE.
const entradas = {
  api: "./apps/api/dist/index.js",
  worker: "./apps/worker/dist/index.js",
  migrate: "./apps/api/dist/migrate.js",
};

const modo = process.env.APP_MODE ?? "api";
const entrada = entradas[modo];
if (!entrada) {
  console.error(`Invalid APP_MODE: "${modo}". Use: ${Object.keys(entradas).join(", ")}`);
  process.exit(1);
}
await import(entrada);
