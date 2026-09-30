/**
 * The background work that outlives a single request: ageing out old
 * operational history, and (where the product has bookings) the reminder
 * a day before a visit. A trial is short and nobody is invoiced from it,
 * so there are no summaries, reports or nudges; a prospect who stops
 * after two days hears nothing more from us.
 *
 * Copied and adapted across the three products.
 */

import { dayStartUtc } from "./dash";
import { q } from "./db";
import { enqueue, registerJob, type Job } from "./jobs";
import { sendSms } from "./sms";
import { getTenant, withTenant, type Tenant } from "./tenancy";
import { configOf } from "./tenant-config";


function tzOf(t: Tenant): string {
  return t.timezone || configOf(t).basics.timezone;
}


/** The next time it is `hour`:00 in the tenant's zone (optionally on `weekday`). */
export function nextLocalTime(tz: string, hour: number): Date {
  let candidate = new Date(dayStartUtc(tz).getTime() + hour * 3_600_000);
  if (candidate.getTime() <= Date.now()) candidate = new Date(candidate.getTime() + 24 * 3_600_000);
  return candidate;
}


/** Called by the cron entry point before running due jobs. */
export async function ensureAutomationSchedules(): Promise<void> {
  // One platform-wide retention pass a day, around 04:00 UTC.
  const [queued] = await q<{ n: number }>(
    `select count(*)::int as n from jobs where kind = 'retention' and status = 'queued'`,
  );
  if ((queued?.n ?? 0) === 0) {
    await enqueue("retention", {}, nextLocalTime("Etc/UTC", 4));
  }
}

/* ------------------------------------------------------------------ jobs */

/** The 24-hour appointment reminder, product-specific. The text carries
 *  nothing beyond date, time, provider and office, and goes only to a
 *  patient who opted in on the call. */
async function runVisitReminder(job: Job): Promise<string> {
  const t = await getTenant(String(job.payload.tenant_id));
  if (!t) return "tenant missing";
  if (t.status !== "active") return `tenant is ${t.status}`;
  const appointmentId = String(job.payload.appointment_id ?? "");

  return withTenant(t, async () => {
    const [apt] = await q<{ status: string; starts_at: string; provider_id: string | null; location_id: string | null; phone: string | null }>(
      `select a.status, a.starts_at, a.provider_id, a.location_id, p.phone
         from demo_appointments a left join demo_patients p on p.id = a.patient_id and p.tenant_id = a.tenant_id
        where a.tenant_id = $1 and a.id = $2`,
      [t.id, appointmentId],
    );
    if (!apt || apt.status === "cancelled") return "appointment gone or cancelled, reminder dropped";
    if (!apt.phone) return "no phone on file";
    const c = configOf(t);
    const provider = c.providers.find((p) => p.id === apt.provider_id)?.name ?? "your provider";
    const office = c.offices.find((o) => o.id === apt.location_id)?.name ?? "the office";
    const whenLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: tzOf(t) }).format(new Date(apt.starts_at));
    const sent = await sendSms({
      to: apt.phone,
      template: "appointment_reminder",
      body: `${t.short_name}: a reminder about your appointment ${whenLabel} with ${provider} at ${office}. Reply STOP to opt out.`,
    });
    return `reminder ${sent.status}`;
  });
}


/* -------------------------------------------------------------- retention */

/** How long the operational trails live. The pipeline trail keeps half a
 *  year; the words and audio of a call go after a month. The audit and
 *  consent logs are records the practice may owe someone, so they stay. */
const EVENT_RETENTION_DAYS = 180;
const MEDIA_RETENTION_DAYS = 30;

async function runRetention(): Promise<string> {
  const notes: string[] = [];
  const rows = await q<{ id: number }>(
    `delete from pipeline_events where occurred_at < now() - make_interval(days => $1) returning id`,
    [EVENT_RETENTION_DAYS],
  );
  if (rows.length) notes.push(`pipeline_events: ${rows.length}`);
  const media = await q<{ call_id: string }>(
    `update demo_calls set transcript = null, recording_url = null
      where started_at < now() - make_interval(days => $1) and (transcript is not null or recording_url is not null)
      returning call_id`,
    [MEDIA_RETENTION_DAYS],
  );
  if (media.length) notes.push(`call media: ${media.length}`);
  const pruned = await q<{ id: number }>(`delete from rate_limits where occurred_at < now() - interval '2 days' returning id`);
  if (pruned.length) notes.push(`rate_limits: ${pruned.length}`);
  return notes.length ? `purged ${notes.join(", ")}` : "nothing old enough";
}
registerJob("visit_reminder", runVisitReminder);
registerJob("retention", async () => {
  const note = await runRetention();
  await enqueue("retention", {}, nextLocalTime("Etc/UTC", 4));
  return note;
});
