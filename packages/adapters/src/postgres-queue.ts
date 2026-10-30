import { sql } from "drizzle-orm";
import { jobs, type Db } from "@certia/db";
import type { Queue } from "./interfaces.js";

/** Postgres-backed job queue. Can be swapped for Cloud Tasks in production. */
export class PostgresQueue implements Queue {
  constructor(private readonly db: Db) {}

  async enqueue(type: string, payload: Record<string, unknown>, options?: { delaySeconds?: number }) {
    const delay = options?.delaySeconds ?? 0;
    await this.db.insert(jobs).values({
      type,
      payload,
      runAt: sql`now() + make_interval(secs => ${delay})`,
    });
  }
}

export type Job = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
};

/**
 * Claims the next pending job. FOR UPDATE SKIP LOCKED lets several workers
 * run at once without two of them taking the same job.
 */
export async function claimJob(db: Db): Promise<Job | undefined> {
  const r = await db.execute<Job>(sql`
    update jobs set status = 'running', attempts = attempts + 1, updated_at = now()
    where id = (
      select id from jobs
      where status = 'pending' and run_at <= now()
      order by run_at
      for update skip locked
      limit 1
    )
    returning id, type, payload, attempts
  `);
  return r.rows[0];
}

export async function completeJob(db: Db, id: number) {
  await db.execute(sql`update jobs set status = 'done', error = null, updated_at = now() where id = ${id}`);
}

/** Retries with exponential backoff up to maxAttempts; then marks the job as failed. */
export async function failJob(db: Db, job: Job, error: string, maxAttempts = 5) {
  const final = job.attempts >= maxAttempts;
  const backoff = 30 * 2 ** (job.attempts - 1);
  await db.execute(sql`
    update jobs set
      status = ${final ? "failed" : "pending"},
      error = ${error},
      run_at = now() + make_interval(secs => ${backoff}),
      updated_at = now()
    where id = ${job.id}
  `);
}
