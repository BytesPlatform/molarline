/**
 * The Book a demo form. Public, so it is careful: a honeypot field, a rate
 * limit per address, and consent required before any automated contact.
 */

import { NextRequest, NextResponse } from "next/server";
import { databaseWarning } from "@/lib/db";
import { createLead, e164 } from "@/lib/leads";
import { allowRate } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "could not record the request", detail: message, hint: databaseWarning() }, { status: 500 });
  }
}

async function handle(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Five requests per address per ten minutes, durable across instances.
  if (!(await allowRate(`leads:${ip}`, 5, 10))) {
    return NextResponse.json({ error: "too many requests, please try again in a few minutes" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Bots fill every field. People never see this one.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

  const name = String(body.name ?? "").trim().slice(0, 120);
  const business = String(body.business ?? "").trim().slice(0, 160);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const phone = e164(String(body.phone ?? ""));
  const message = String(body.message ?? "").trim().slice(0, 1500);
  const consent = body.consent === true;

  if (!name) return NextResponse.json({ error: "your name is required" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "a valid email address is required" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "a valid phone number is required, so we can call you" }, { status: 400 });
  if (!consent) return NextResponse.json({ error: "please tick the consent box so we are allowed to call you" }, { status: 400 });

  const result = await createLead({
    name,
    business: business || null,
    email,
    phone,
    message: message || null,
    consent,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, lead_id: result.lead.id });
}
