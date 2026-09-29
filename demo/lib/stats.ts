/**
 * The numbers a practice is sent about its week and its day.
 * Product-specific: each product counts what its dashboard counts.
 */
import { dayStartUtc } from "./dash";
import { q } from "./db";

export interface WeekStats {
  calls: number;
  lines: { label: string; value: string }[];
}

export interface DayStats {
  calls: number;
  lines: { label: string; value: string }[];
  /** Open items on the dashboard's Needs-you list. */
  needsYou: number;
}

/** Today so far, in the practice's timezone, for the close-of-business email. */
export async function dayStats(tenantId: string, tz: string): Promise<DayStats> {
  const today = dayStartUtc(tz);
  const [s] = await q<{ calls: number; booked: number; flagged: number; queued: number }>(
    `select (select count(*)::int from demo_calls where tenant_id = $1 and started_at >= $2) as calls,
            (select count(*)::int from demo_appointments where tenant_id = $1 and created_by = 'ai_agent' and status <> 'cancelled' and created_at >= $2) as booked,
            (select count(*)::int from demo_calls where tenant_id = $1 and flagged and started_at >= $2) as flagged,
            (select count(*)::int from booking_queue where tenant_id = $1 and fulfilled_at is null) as queued`,
    [tenantId, today],
  );
  return {
    calls: s.calls,
    lines: [
      { label: "Calls answered", value: String(s.calls) },
      { label: "Appointments booked by the assistant", value: String(s.booked) },
      { label: "Calls handed to staff", value: String(s.flagged) },
    ],
    needsYou: s.queued,
  };
}

export async function weekStats(tenantId: string): Promise<WeekStats> {
  const [s] = await q<{ calls: number; booked: number; flagged: number; queued: number }>(
    `select (select count(*)::int from demo_calls where tenant_id = $1 and started_at > now() - interval '7 days') as calls,
            (select count(*)::int from demo_appointments where tenant_id = $1 and created_by = 'ai_agent' and status <> 'cancelled' and created_at > now() - interval '7 days') as booked,
            (select count(*)::int from demo_calls where tenant_id = $1 and flagged and started_at > now() - interval '7 days') as flagged,
            (select count(*)::int from booking_queue where tenant_id = $1 and fulfilled_at is null) as queued`,
    [tenantId],
  );
  return {
    calls: s.calls,
    lines: [
      { label: "Calls answered", value: String(s.calls) },
      { label: "Appointments booked by the assistant", value: String(s.booked) },
      { label: "Calls handed to staff for a clinical or billing question", value: String(s.flagged) },
      { label: "Requests waiting in the front desk queue", value: String(s.queued) },
    ],
  };
}
