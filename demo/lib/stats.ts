/**
 * The numbers a practice is sent about its week. Product-specific: each
 * product counts what its dashboard counts.
 */
import { q } from "./db";

export interface WeekStats {
  calls: number;
  lines: { label: string; value: string }[];
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
