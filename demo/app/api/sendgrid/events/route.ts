/**
 * SendGrid's event webhook: delivered, open, click, bounce, dropped, spam.
 *
 * Set it up once in SendGrid under Settings, Mail Settings, Event Webhook,
 * pointing at this URL with signature verification on, and paste the
 * verification key into SENDGRID_WEBHOOK_PUBLIC_KEY. Until that key exists
 * the route refuses every post, because an unsigned event could mark any
 * message as anything.
 */

import { NextRequest, NextResponse } from "next/server";
import { recordEmailEvent } from "@/lib/messaging/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SendGridEvent {
  event: string;
  timestamp?: number;
  email?: string;
  reason?: string;
  status?: string;
  url?: string;
  message_id?: string;
  sg_message_id?: string;
  sg_event_id?: string;
}

export async function POST(request: NextRequest) {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "SENDGRID_WEBHOOK_PUBLIC_KEY is not set" }, { status: 401 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-twilio-email-event-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-twilio-email-event-webhook-timestamp") ?? "";

  const { EventWebhook } = await import("@sendgrid/eventwebhook");
  const verifier = new EventWebhook();
  const key = verifier.convertPublicKeyToECDSA(publicKey);
  if (!verifier.verifySignature(key, rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: SendGridEvent[];
  try {
    events = JSON.parse(rawBody);
    if (!Array.isArray(events)) throw new Error("not an array");
  } catch {
    return NextResponse.json({ error: "body is not a JSON array" }, { status: 400 });
  }

  let applied = 0;
  for (const e of events) {
    const id = Number(e.message_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    await recordEmailEvent(id, e.event, new Date((e.timestamp ?? Date.now() / 1000) * 1000), {
      reason: e.reason ?? e.status ?? undefined,
      url: e.url ?? undefined,
      sg_event_id: e.sg_event_id ?? undefined,
    });
    applied += 1;
  }
  return NextResponse.json({ received: events.length, applied });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "sendgrid event webhook", configured: Boolean(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY) });
}
