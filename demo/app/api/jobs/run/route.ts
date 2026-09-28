/**
 * The job worker. Vercel Cron calls it on the schedule in vercel.json with
 * "Authorization: Bearer <CRON_SECRET>". Without CRON_SECRET set the route
 * refuses everything, so a deployment cannot be driven by strangers.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDueJobs } from "@/lib/jobs";
// Registers the handlers. Nothing else imports leads on this path.
import "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: process.env.CRON_SECRET ? "unauthorised" : "CRON_SECRET is not set" }, { status: 401 });
  }
  const report = await runDueJobs();
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...report });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
