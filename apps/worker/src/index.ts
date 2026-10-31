import { setTimeout as sleep } from "node:timers/promises";
import { claimJob, completeJob, createAdapters, failJob } from "@certia/adapters";
import { createDb } from "@certia/db";
import { loadCatalog } from "@certia/measures";
import { handlers, type JobContext } from "./jobs.js";

const IDLE_WAIT_MS = 2000;

const { db, pool } = createDb();
const ctx: JobContext = { db, adapters: createAdapters(db), catalog: loadCatalog() };

let running = true;
const stop = () => {
  console.log("[worker] stopping…");
  running = false;
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

console.log(`[worker] running. Registered jobs: ${Object.keys(handlers).join(", ")}`);

while (running) {
  let job;
  try {
    job = await claimJob(db);
  } catch (e) {
    console.error("[worker] error reading the queue:", (e as Error).message);
    await sleep(IDLE_WAIT_MS * 5);
    continue;
  }

  if (!job) {
    await sleep(IDLE_WAIT_MS);
    continue;
  }

  const handler = handlers[job.type];
  try {
    if (!handler) throw new Error(`No handler for "${job.type}"`);
    await handler(job.payload, ctx);
    await completeJob(db, job.id);
  } catch (e) {
    const message = (e as Error).message;
    console.error(`[worker] job ${job.id} (${job.type}) failed: ${message}`);
    await failJob(db, job, message);
  }
}

await pool.end();
