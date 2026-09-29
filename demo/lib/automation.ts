/**
 * The recurring automation: the close-of-business summary, the Monday
 * weekly report, the "is forwarding still on?" nudge after a silent week,
 * and the 24-hour visit reminder. Each scheduled job re-enqueues its next
 * occurrence, and the cron entry point heals missing schedules for every
 * active tenant, so a workspace that went live before this existed still
 * gets its emails.
 *
 * Copied and adapted across the three products: the reminder handler and
 * the summary lines are this product's.
 */

import { createElement } from "react";
import { DailySummary, ReEngagement } from "@/emails/Notify";
import { WeeklyReport } from "@/emails/Onboarding";
import { dayStartUtc } from "./dash";
import { q } from "./db";
import { enqueue, registerJob, type Job } from "./jobs";
import { sendEmail } from "./messaging/email";
import { owners } from "./notify";
import { sendSms } from "./sms";
import { dayStats, weekStats } from "./stats";
import { getTenant, withTenant, type Tenant } from "./tenancy";
import { configOf } from "./tenant-config";

const SUMMARY_HOUR = 18; // close of business, tenant time
const REPORT_HOUR = 8; // Monday morning, tenant time

function tzOf(t: Tenant): string {
  return t.timezone || configOf(t).basics.timezone;
}

function weekdayIn(tz: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  }
}

/** The next time it is `hour`:00 in the tenant's zone (optionally on `weekday`). */
export function nextLocalTime(tz: string, hour: number, weekday?: "Mon"): Date {
  let candidate = new Date(dayStartUtc(tz).getTime() + hour * 3_600_000);
  for (let i = 0; i < 8; i++) {
    const wrongDay = weekday && weekdayIn(tz, candidate) !== weekday;
    if (candidate.getTime() > Date.now() && !wrongDay) return candidate;
    candidate = new Date(candidate.getTime() + 24 * 3_600_000);
  }
  return candidate;
}

async function enqueueIfAbsent(kind: "daily_summary" | "weekly_report", tenantId: string, runAt: Date): Promise<boolean> {
  const rows = await q<{ ok: number }>(
    `select 1 as ok from jobs where tenant_id = $1 and kind = $2 and status = 'queued' limit 1`,
    [tenantId, kind],
  );
  if (rows.length) return false;
  await enqueue(kind, { tenant_id: tenantId }, runAt, { tenantId });
  return true;
}

export async function ensureTenantSchedules(t: Tenant): Promise<void> {
  const tz = tzOf(t);
  await enqueueIfAbsent("daily_summary", t.id, nextLocalTime(tz, SUMMARY_HOUR));
  await enqueueIfAbsent("weekly_report", t.id, nextLocalTime(tz, REPORT_HOUR, "Mon"));
}

/** Called by the cron entry point before running due jobs. */
export async function ensureAutomationSchedules(): Promise<void> {
  const tenants = await q<Tenant>(`select * from tenants where status = 'active' and id <> 'demo'`);
  for (const t of tenants) await ensureTenantSchedules(t);
  // One platform-wide retention pass a day, around 04:00 UTC.
  const [queued] = await q<{ n: number }>(
    `select count(*)::int as n from jobs where kind = 'retention' and status = 'queued'`,
  );
  if ((queued?.n ?? 0) === 0) {
    await enqueue("retention", {}, nextLocalTime("Etc/UTC", 4));
  }
}

/* ------------------------------------------------------------------ jobs */

async function runDailySummary(job: Job): Promise<string> {
  const t = await getTenant(String(job.payload.tenant_id));
  if (!t) return "tenant missing";
  const tz = tzOf(t);
  // Tomorrow's summary is on the books before today's is even attempted.
  await enqueueIfAbsent("daily_summary", t.id, nextLocalTime(tz, SUMMARY_HOUR));
  if (t.status !== "active") return `tenant is ${t.status}`;

  const stats = await dayStats(t.id, tz);
  const notes: string[] = [];

  if (stats.calls === 0 && stats.needsYou === 0) {
    notes.push("quiet day, summary skipped");
  } else {
    const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz }).format(new Date());
    for (const owner of await owners(t.id)) {
      const sent = await sendEmail({
        to: owner.email,
        subject: `Today: ${stats.lines.map((l) => `${l.value} ${l.label.toLowerCase()}`).slice(0, 2).join(", ")}`,
        template: "daily_summary",
        tenantId: t.id,
        react: createElement(DailySummary, { firstName: owner.firstName, dateLabel, lines: stats.lines, needsYou: stats.needsYou }),
      });
      if (sent.status === "failed") throw new Error(sent.error ?? "send failed");
    }
    notes.push("summary sent");
  }

  // A live line that has answered nothing for a week is worth a nudge,
  // at most once a week.
  const c = configOf(t);
  const liveLongEnough = c.onboarding.completedAt && Date.now() - new Date(c.onboarding.completedAt).getTime() > 7 * 86_400_000;
  if (liveLongEnough) {
    const [quiet] = await q<{ calls: number }>(
      `select count(*)::int as calls from demo_calls where tenant_id = $1 and started_at > now() - interval '7 days'`,
      [t.id],
    );
    if (quiet.calls === 0) {
      const [already] = await q<{ n: number }>(
        `select count(*)::int as n from messages where tenant_id = $1 and template = 're_engagement' and created_at > now() - interval '6 days'`,
        [t.id],
      );
      if (already.n === 0) {
        const number = c.phone.number || t.phone_number || "";
        for (const owner of await owners(t.id)) {
          await sendEmail({
            to: owner.email,
            subject: "No calls in a week. Is forwarding still on?",
            template: "re_engagement",
            tenantId: t.id,
            react: createElement(ReEngagement, { firstName: owner.firstName, number }),
          });
        }
        notes.push("re-engagement sent");
      }
    }
  }

  return notes.join("; ");
}

async function runWeeklyReport(job: Job): Promise<string> {
  const t = await getTenant(String(job.payload.tenant_id));
  if (!t) return "tenant missing";
  await enqueueIfAbsent("weekly_report", t.id, nextLocalTime(tzOf(t), REPORT_HOUR, "Mon"));
  if (t.status !== "active") return `tenant is ${t.status}`;

  const stats = await weekStats(t.id);
  for (const owner of await owners(t.id)) {
    const sent = await sendEmail({
      to: owner.email,
      subject: `Your week: ${stats.lines.map((l) => `${l.value} ${l.label.toLowerCase()}`).slice(0, 2).join(", ")}`,
      template: "weekly_report",
      tenantId: t.id,
      react: createElement(WeeklyReport, { firstName: owner.firstName, stats }),
    });
    if (sent.status === "failed") throw new Error(sent.error ?? "send failed");
  }
  return "weekly report sent";
}

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
registerJob("daily_summary", runDailySummary);
registerJob("weekly_report", runWeeklyReport);
registerJob("visit_reminder", runVisitReminder);
registerJob("retention", async () => {
  const note = await runRetention();
  await enqueue("retention", {}, nextLocalTime("Etc/UTC", 4));
  return note;
});
