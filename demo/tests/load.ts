/**
 * A concurrent-call load test against the tool webhook, the hot path a
 * real call hammers. Aim it at a local production build by default:
 *
 *   npm run build && npm start          # in one terminal
 *   npx tsx tests/load.ts               # in another
 *
 * Options via env: TARGET_URL (default http://localhost:3000),
 * LOAD_CONCURRENCY (default 20), LOAD_TOTAL (default 200). Each request
 * is a signed-shape tool call that writes a call row, so it exercises
 * the database, the tenant context and the tool dispatch, not just the
 * router. Do not aim it at production unless you mean to.
 */

import { createHmac } from "node:crypto";

const TARGET = (process.env.TARGET_URL || "http://localhost:3000").replace(/\/$/, "");
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY) || 20;
const TOTAL = Number(process.env.LOAD_TOTAL) || 200;
// With RETELL_API_KEY set the requests are signed like Retell's own; without
// it, start the target with ALLOW_UNSIGNED_WEBHOOKS=true.
const KEY = process.env.RETELL_API_KEY || "";

function signature(rawBody: string): string | null {
  if (!KEY) return null;
  const ts = Date.now().toString();
  const digest = createHmac("sha256", KEY).update(rawBody + ts).digest("hex");
  return `v=${ts},d=${digest}`;
}

interface Sample {
  ms: number;
  status: number;
  ok: boolean;
}

async function one(i: number): Promise<Sample> {
  const body = JSON.stringify({
    name: "find_patient",
    call: { call_id: `load_${Date.now().toString(36)}_${i}` },
    args: { first_name: "Load", last_name: "Test", date_of_birth: "1990-01-01" },
  });
  const started = performance.now();
  try {
    const sig = signature(body);
    const res = await fetch(`${TARGET}/api/retell/tool`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(sig ? { "x-retell-signature": sig } : {}) },
      body,
    });
    await res.text();
    return { ms: performance.now() - started, status: res.status, ok: res.ok };
  } catch {
    return { ms: performance.now() - started, status: 0, ok: false };
  }
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  console.log(`load: ${TOTAL} requests, ${CONCURRENCY} concurrent, against ${TARGET}`);
  const samples: Sample[] = [];
  let next = 0;
  const startedAt = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < TOTAL) {
        const i = next++;
        samples.push(await one(i));
      }
    }),
  );
  const wall = performance.now() - startedAt;
  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const failures = samples.filter((s) => !s.ok);
  console.log(`wall time ${Math.round(wall)}ms, ${(TOTAL / (wall / 1000)).toFixed(1)} req/s`);
  console.log(`latency p50 ${Math.round(pct(times, 50))}ms, p95 ${Math.round(pct(times, 95))}ms, max ${Math.round(times[times.length - 1])}ms`);
  console.log(`failures: ${failures.length}${failures.length ? ` (statuses ${[...new Set(failures.map((f) => f.status))].join(", ")})` : ""}`);
  if (failures.length > TOTAL * 0.01) {
    console.error("LOAD TEST FAILED: more than 1% of requests failed");
    process.exit(1);
  }
  console.log("load test passed");
}

main();
