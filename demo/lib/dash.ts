/**
 * What the customer dashboard shows. Product-specific: the three numbers
 * are this practice's (calls, appointments booked, open requests); the
 * needs-you list is the front desk queue plus flagged calls. Days run in
 * the tenant's timezone, not the server's.
 */

import { q } from "./db";
import { configOf } from "./tenant-config";
import type { Tenant } from "./tenancy";

export interface StatCard {
  label: string;
  today: number;
  yesterday: number;
}

export interface NeedsYouItem {
  /** Product-specific: this product uses queue, flagged and failed_message. */
  kind: string;
  id: string;
  title: string;
  detail: string;
  when: string;
  phone: string | null;
  /** Set when "Done" can clear it from the list. */
  canDone: boolean;
  /** Set when the item points at a call worth opening. */
  callId: string | null;
}

/** What the little green tag on a handled call says, in this product's words. */
export const BOOKED_TAG = "booked";
/** The upcoming panel's title, in this product's words. */
export const UPCOMING_TITLE = "Upcoming appointments";

export interface CallRow {
  call_id: string;
  flagged: boolean;
  started_at: string;
  ended_at: string | null;
  channel: string;
  from_number: string | null;
  urgency: string | null;
  outcome: string | null;
  after_hours: boolean;
  booked: boolean;
  ticket_value: number | null;
  summary: string | null;
  has_transcript: boolean;
  has_recording: boolean;
}

export interface CallDetail extends CallRow {
  transcript: string | null;
  recording_url: string | null;
  pipeline: { step: string; status: string; detail: string | null; occurred_at: string }[];
  events: { action: string; outcome: string | null; urgency: string | null; occurred_at: string }[];
  texts: { to_label: string | null; to_number: string; body: string; status: string; created_at: string }[];
}

export interface UpcomingVisit {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  worker_name: string | null;
  urgency: string;
  by_agent: boolean;
}

export interface HomeData {
  stats: StatCard[];
  needsYou: NeedsYouItem[];
  todaysCalls: CallRow[];
  upcoming: UpcomingVisit[];
  agent: {
    published: boolean;
    phoneNumber: string | null;
    weekCalls: number;
    avgSeconds: number | null;
  };
  hasAnyCalls: boolean;
  timezone: string;
}

/** Midnight, `daysBack` days ago, in the tenant's timezone, as a UTC instant. */
export function dayStartUtc(tz: string, daysBack = 0): Date {
  const now = new Date();
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysBack);
    return d;
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const midnightAsUtc = Date.UTC(get("year"), get("month") - 1, get("day") - daysBack);
  return new Date(midnightAsUtc - offsetMs);
}

/* The practice's calls table has no urgency or booked column: a call counts
   as booked when the assistant wrote an appointment for it. */
const CALL_COLS = `c.call_id, c.flagged, c.started_at, c.ended_at, c.channel, null as from_number, null as urgency,
       c.outcome, false as after_hours,
       exists (select 1 from demo_appointments a where a.tenant_id = c.tenant_id and a.call_id = c.call_id and a.status <> 'cancelled') as booked,
       null::float as ticket_value, c.summary,
       (c.transcript is not null) as has_transcript, (c.recording_url is not null) as has_recording`;

export async function homeData(tenant: Tenant): Promise<HomeData> {
  const c = configOf(tenant);
  const tz = tenant.timezone || c.basics.timezone;
  const today = dayStartUtc(tz);
  const yesterday = dayStartUtc(tz, 1);

  const [callCounts] = await q<{ t_calls: number; y_calls: number; all_calls: number }>(
    `select count(*) filter (where started_at >= $2)::int as t_calls,
            count(*) filter (where started_at >= $3 and started_at < $2)::int as y_calls,
            count(*)::int as all_calls
       from demo_calls where tenant_id = $1`,
    [tenant.id, today, yesterday],
  );
  const [apptCounts] = await q<{ t_booked: number; y_booked: number }>(
    `select count(*) filter (where created_at >= $2)::int as t_booked,
            count(*) filter (where created_at >= $3 and created_at < $2)::int as y_booked
       from demo_appointments where tenant_id = $1 and created_by = 'ai_agent' and status <> 'cancelled'`,
    [tenant.id, today, yesterday],
  );
  const [queueCounts] = await q<{ open_now: number; open_midnight: number }>(
    `select count(*) filter (where fulfilled_at is null)::int as open_now,
            count(*) filter (where created_at < $2 and (fulfilled_at is null or fulfilled_at >= $2))::int as open_midnight
       from booking_queue where tenant_id = $1`,
    [tenant.id, today],
  );

  const stats: StatCard[] = [
    { label: "Calls today", today: callCounts.t_calls, yesterday: callCounts.y_calls },
    { label: "Appointments booked", today: apptCounts.t_booked, yesterday: apptCounts.y_booked },
    { label: "Open requests", today: queueCounts.open_now, yesterday: queueCounts.open_midnight },
  ];

  const queue = await q<{ id: number; call_id: string | null; patient_ref: string | null; location: string | null; reason: string | null; requested: unknown; created_at: string }>(
    `select id, call_id, patient_ref, location, reason, requested, created_at
       from booking_queue where tenant_id = $1 and fulfilled_at is null order by created_at desc limit 8`,
    [tenant.id],
  );
  const flagged = await q<{ call_id: string; summary: string | null; started_at: string }>(
    `select call_id, summary, started_at from demo_calls
      where tenant_id = $1 and flagged and started_at > now() - interval '7 days'
      order by started_at desc limit 5`,
    [tenant.id],
  );
  const failed = await q<{ id: number; to_address: string; template: string; created_at: string }>(
    `select id, to_address, template, created_at from messages
      where tenant_id = $1 and status = 'failed' and created_at > now() - interval '7 days'
      order by created_at desc limit 5`,
    [tenant.id],
  );

  const needsYou: NeedsYouItem[] = [
    ...queue.map((r) => ({
      kind: "queue",
      id: String(r.id),
      title: r.reason || "Front desk request",
      detail: [r.patient_ref, r.location, typeof r.requested === "object" && r.requested ? JSON.stringify(r.requested).slice(1, 120) : null]
        .filter(Boolean)
        .join(" · ") || "The assistant queued this for the front desk.",
      when: r.created_at,
      phone: null,
      canDone: true,
      callId: r.call_id,
    })),
    ...flagged.map((r) => ({
      kind: "flagged",
      id: r.call_id,
      title: "A call was handed to staff",
      detail: r.summary || "The caller raised something clinical or billing; the assistant stepped back.",
      when: r.started_at,
      phone: null,
      canDone: false,
      callId: r.call_id,
    })),
    ...failed.map((r) => ({
      kind: "failed_message",
      id: String(r.id),
      title: `A message to ${r.to_address} failed`,
      detail: r.template,
      when: r.created_at,
      phone: null,
      canDone: false,
      callId: null,
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1));

  const todaysCalls = await q<CallRow>(
    `select ${CALL_COLS} from demo_calls c
      where c.tenant_id = $1 and c.started_at >= $2 order by c.started_at desc limit 8`,
    [tenant.id, today],
  );

  const upcomingRows = await q<{
    id: string; starts_at: string; ends_at: string; status: string; created_by: string;
    provider_id: string | null; type_id: string | null; first_name: string | null; last_name: string | null;
  }>(
    `select a.id, a.starts_at, a.ends_at, a.status, a.created_by, a.provider_id, a.type_id, p.first_name, p.last_name
       from demo_appointments a left join demo_patients p on p.id = a.patient_id and p.tenant_id = a.tenant_id
      where a.tenant_id = $1 and a.status <> 'cancelled' and a.ends_at >= now()
      order by a.starts_at asc limit 4`,
    [tenant.id],
  );
  const providerName = new Map(c.providers.map((p) => [p.id, p.name]));
  const typeName = new Map(c.appointmentTypes.map((t) => [t.id, t.name]));
  const upcoming: UpcomingVisit[] = upcomingRows.map((v) => ({
    id: v.id,
    title: (v.type_id && typeName.get(v.type_id)) || "Appointment",
    starts_at: v.starts_at,
    ends_at: v.ends_at,
    client_name: [v.first_name, v.last_name ? `${v.last_name[0]}.` : null].filter(Boolean).join(" ") || "Patient",
    worker_name: (v.provider_id && providerName.get(v.provider_id)) || null,
    urgency: v.status === "confirmed" ? "routine" : "quote",
    by_agent: v.created_by === "ai_agent",
  }));

  const [week] = await q<{ calls: number; avg_seconds: number | null }>(
    `select count(*)::int as calls,
            avg(extract(epoch from (ended_at - started_at)))::float as avg_seconds
       from demo_calls where tenant_id = $1 and started_at > now() - interval '7 days' and ended_at is not null`,
    [tenant.id],
  );

  return {
    stats,
    needsYou,
    todaysCalls,
    upcoming,
    agent: {
      published: Boolean(tenant.retell_agent_id),
      phoneNumber: tenant.phone_number || c.phone.existingNumber || null,
      weekCalls: week?.calls ?? 0,
      avgSeconds: week?.avg_seconds ?? null,
    },
    hasAnyCalls: callCounts.all_calls > 0,
    timezone: tz,
  };
}

export async function listCalls(tenantId: string, limit = 50): Promise<CallRow[]> {
  return q<CallRow>(
    `select ${CALL_COLS} from demo_calls c where c.tenant_id = $1 order by c.started_at desc limit $2`,
    [tenantId, limit],
  );
}

export async function callDetail(tenantId: string, callId: string): Promise<CallDetail | null> {
  const [call] = await q<CallDetail>(
    `select ${CALL_COLS}, c.transcript, c.recording_url from demo_calls c where c.tenant_id = $1 and c.call_id = $2`,
    [tenantId, callId],
  );
  if (!call) return null;
  call.pipeline = await q(
    `select step, status, detail, occurred_at from pipeline_events
      where tenant_id = $1 and call_id = $2 order by id asc limit 40`,
    [tenantId, callId],
  );
  // The audit log stands in for call events in this product.
  call.events = await q(
    `select action, outcome, null as urgency, occurred_at from phi_access_log
      where tenant_id = $1 and call_id = $2 order by id asc limit 40`,
    [tenantId, callId],
  );
  call.texts = [];
  return call;
}

/** "Done" on a Needs-you row, routed by the product-specific kind. */
export async function markNeedsDone(tenantId: string, kind: string, id: string): Promise<void> {
  if (kind === "queue") {
    await q(
      `update booking_queue set fulfilled_at = now(), fulfilled_by = 'dashboard'
        where tenant_id = $1 and id = $2 and fulfilled_at is null`,
      [tenantId, Number(id)],
    );
  }
}

/** This month's answered minutes against the plan, for the billing card. */
export async function monthUsage(tenant: Tenant): Promise<{ minutes: number; included: number; plan: string }> {
  const c = configOf(tenant);
  const tz = tenant.timezone || c.basics.timezone;
  const now = dayStartUtc(tz);
  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  const [row] = await q<{ seconds: number }>(
    `select coalesce(sum(extract(epoch from (ended_at - started_at))), 0)::float as seconds
       from demo_calls where tenant_id = $1 and started_at >= $2 and ended_at is not null`,
    [tenant.id, monthStart],
  );
  return { minutes: Math.ceil((row?.seconds ?? 0) / 60), included: tenant.included_minutes ?? 0, plan: tenant.plan || "trial" };
}
