import { createAdapters } from "@certia/adapters";
import { createDb } from "@certia/db";
import { loadCatalog } from "@certia/fichas";
import { buildApp } from "./app.js";
import { config } from "./config.js";

const { db, pool } = createDb();
const app = await buildApp({ db, config, catalog: loadCatalog(), adapters: createAdapters(db) });

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ host: "0.0.0.0", port: config.port });
