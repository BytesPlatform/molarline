/**
 * A durable rate limiter for the public routes. One insert and one count
 * per check, so the limit holds across serverless instances, unlike an
 * in-memory map that resets on every cold start. The retention job prunes
 * the table; a cheap opportunistic prune here keeps it small meanwhile.
 *
 * Shared across the three products.
 */

import { q } from "./db";

/** True when the caller is still within `limit` hits per `windowMinutes`. */
export async function allowRate(key: string, limit: number, windowMinutes: number): Promise<boolean> {
  await q(`insert into rate_limits (key) values ($1)`, [key]);
  const [row] = await q<{ n: number }>(
    `select count(*)::int as n from rate_limits where key = $1 and occurred_at > now() - make_interval(mins => $2)`,
    [key, windowMinutes],
  );
  if (Math.random() < 0.02) {
    await q(`delete from rate_limits where occurred_at < now() - interval '2 days'`);
  }
  return (row?.n ?? 0) <= limit;
}
