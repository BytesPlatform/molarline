/**
 * Usage metering: what each customer's assistant talked this month, in
 * billable minutes. A call is rounded up to the next whole minute, per
 * call, exactly as the pricing page says; the month runs in the tenant's
 * timezone. The admin console shows this per customer and exports it, so
 * an invoice takes a minute to raise.
 *
 * Shared across the three products.
 */

import { q } from "./db";
import { configOf } from "./tenant-config";
import type { Tenant } from "./tenancy";

export const OVERAGE_PER_MINUTE = 0.25;

export interface TenantUsage {
  id: string;
  name: string;
  plan: string;
  included: number;
  calls: number;
  minutes: number;
  overageMinutes: number;
  overageCost: number;
}

/** The first instant of the month `monthsBack` ago, in the tenant's zone. */
export function monthStartUtc(tz: string, monthsBack = 0): Date {
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
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - monthsBack);
    return d;
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(get("year"), get("month") - 1 - monthsBack, 1) - offsetMs);
}

export async function tenantUsage(t: Tenant, monthsBack = 0): Promise<TenantUsage> {
  const tz = t.timezone || configOf(t).basics.timezone;
  const from = monthStartUtc(tz, monthsBack);
  const to = monthStartUtc(tz, monthsBack - 1);
  const [row] = await q<{ calls: number; minutes: number }>(
    `select count(*)::int as calls,
            coalesce(sum(ceil(greatest(extract(epoch from (ended_at - started_at)), 1) / 60)), 0)::float as minutes
       from demo_calls
      where tenant_id = $1 and ended_at is not null and started_at >= $2 and started_at < $3`,
    [t.id, from, to],
  );
  const minutes = Math.round(row?.minutes ?? 0);
  const included = t.included_minutes ?? 0;
  const overageMinutes = Math.max(0, minutes - included);
  return {
    id: t.id,
    name: t.name,
    plan: t.plan || "trial",
    included,
    calls: row?.calls ?? 0,
    minutes,
    overageMinutes,
    overageCost: Math.round(overageMinutes * OVERAGE_PER_MINUTE * 100) / 100,
  };
}

export async function usageForMonth(monthsBack = 0): Promise<{ label: string; rows: TenantUsage[] }> {
  const tenants = await q<Tenant>(`select * from tenants where id <> 'demo' order by name asc`);
  const rows: TenantUsage[] = [];
  for (const t of tenants) rows.push(await tenantUsage(t, monthsBack));
  const anchor = new Date();
  anchor.setUTCDate(15);
  anchor.setUTCMonth(anchor.getUTCMonth() - monthsBack);
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(anchor);
  return { label, rows };
}

export function usageCsv(label: string, rows: TenantUsage[]): string {
  const head = "customer,plan,calls,minutes,included,overage_minutes,overage_cost_usd,month";
  const lines = rows.map((r) =>
    [JSON.stringify(r.name), r.plan, r.calls, r.minutes, r.included, r.overageMinutes, r.overageCost.toFixed(2), JSON.stringify(label)].join(","),
  );
  return [head, ...lines].join("\r\n") + "\r\n";
}
