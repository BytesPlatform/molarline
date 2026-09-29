/**
 * Jobs: things that happen later.
 *
 * A row in the jobs table with a run_at. Vercel Cron calls /api/jobs/run
 * every five minutes (the console can also run it on demand), which claims
 * the due rows and runs each one. A job
 * that throws is retried up to three times, then marked failed and shown in
 * the admin console. Nothing here is clever on purpose: the table is the
 * queue, and the console is the monitoring.
 *
 * Copied and adapted across the three products. Keep the file name.
 */

import { q } from "./db";

export type JobKind =
  | "lead_followup"
  | "onboarding_nudge"
  | "tenant_lifecycle"
  | "daily_summary"
  | "weekly_report"
  | "visit_reminder"
  | "retention";

export interface Job {
  id: number;
  created_at: string;
  run_at: string;
  kind: JobKind | string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  attempts: number;
  last_error: string | null;
  finished_at: string | null;
  lead_id: number | null;
  tenant_id: string | null;
}

const MAX_ATTEMPTS = 3;

export async function enqueue(
  kind: JobKind,
  payload: Record<string, unknown>,
  runAt: Date,
  scope: { leadId?: number | null; tenantId?: string | null } = {},
): Promise<number> {
  const rows = await q<{ id: number }>(
    `insert into jobs (kind, payload, run_at, lead_id, tenant_id) values ($1,$2,$3,$4,$5) returning id`,
    [kind, JSON.stringify(payload), runAt.toISOString(), scope.leadId ?? null, scope.tenantId ?? null],
  );
  return Number(rows[0]?.id ?? 0);
}

/** Cancels every queued job for a lead, for example when they book or reply. */
export async function cancelLeadJobs(leadId: number): Promise<number> {
  const rows = await q<{ id: number }>(
    `update jobs set status = 'cancelled', finished_at = now() where lead_id = $1 and status = 'queued' returning id`,
    [leadId],
  );
  return rows.length;
}

export type JobHandler = (job: Job) => Promise<string | void>;

/** Handlers are registered by the module that owns the work, so this file knows nothing about leads. */
const handlers = new Map<string, JobHandler>();

export function registerJob(kind: JobKind, handler: JobHandler): void {
  handlers.set(kind, handler);
}

export interface RunReport {
  claimed: number;
  done: number;
  failed: number;
  retried: number;
  results: { id: number; kind: string; outcome: string }[];
}

/** Claims due jobs and runs them, one at a time, in id order. */
export async function runDueJobs(limit = 25): Promise<RunReport> {
  const due = await q<Job>(
    `update jobs set status = 'running', attempts = attempts + 1
      where id in (
        select id from jobs where status = 'queued' and run_at <= now() order by run_at asc, id asc limit $1
      )
      returning id, created_at, run_at, kind, payload, status, attempts, last_error, finished_at, lead_id, tenant_id`,
    [limit],
  );

  const report: RunReport = { claimed: due.length, done: 0, failed: 0, retried: 0, results: [] };

  for (const job of due) {
    const handler = handlers.get(job.kind);
    try {
      if (!handler) throw new Error(`no handler registered for ${job.kind}`);
      const note = (await handler(job)) ?? "ok";
      await q(`update jobs set status = 'done', finished_at = now(), last_error = null where id = $1`, [job.id]);
      report.done += 1;
      report.results.push({ id: job.id, kind: job.kind, outcome: note });
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      if (job.attempts >= MAX_ATTEMPTS) {
        await q(`update jobs set status = 'failed', finished_at = now(), last_error = $2 where id = $1`, [job.id, message]);
        report.failed += 1;
        // Our own team hears about a job that ran out of retries.
        const { alertPlatform } = await import("./alerts");
        await alertPlatform(`A background job failed: ${job.kind}`, [
          `Job ${job.id} (${job.kind}) failed after ${job.attempts} attempts.`,
          `The error: ${message}`,
          job.tenant_id ? `Tenant: ${job.tenant_id}.` : "",
        ].filter(Boolean));
      } else {
        // Back off: ten minutes, then an hour.
        const delayMs = job.attempts === 1 ? 10 * 60_000 : 60 * 60_000;
        await q(`update jobs set status = 'queued', run_at = $2, last_error = $3 where id = $1`, [
          job.id,
          new Date(Date.now() + delayMs).toISOString(),
          message,
        ]);
        report.retried += 1;
      }
      report.results.push({ id: job.id, kind: job.kind, outcome: `error: ${message}` });
    }
  }

  return report;
}

export async function jobCounts(): Promise<{ queued: number; running: number; failed: number; done_24h: number; next_run_at: string | null }> {
  const rows = await q<{ queued: number; running: number; failed: number; done_24h: number; next_run_at: string | null }>(
    `select
       (select count(*)::int from jobs where status = 'queued') as queued,
       (select count(*)::int from jobs where status = 'running') as running,
       (select count(*)::int from jobs where status = 'failed') as failed,
       (select count(*)::int from jobs where status = 'done' and finished_at > now() - interval '24 hours') as done_24h,
       (select min(run_at)::text from jobs where status = 'queued') as next_run_at`,
  );
  return rows[0];
}

export async function listJobs(limit = 50): Promise<Job[]> {
  return q<Job>(
    `select id, created_at, run_at, kind, payload, status, attempts, last_error, finished_at, lead_id, tenant_id
     from jobs order by id desc limit $1`,
    [limit],
  );
}

export async function retryJob(id: number): Promise<void> {
  await q(`update jobs set status = 'queued', run_at = now(), attempts = 0, last_error = null, finished_at = null where id = $1 and status = 'failed'`, [id]);
}
