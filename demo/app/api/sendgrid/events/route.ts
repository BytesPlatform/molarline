/**
 * SendGrid's event webhook: delivered, open, click, bounce, dropped, spam.
 *
 * Set it up once in SendGrid under Settings, Mail Settings, Event Webhook,
 * pointing at this URL with signature verification on, and paste the
 * verification key into SENDGRID_WEBHOOK_PUBLIC_KEY. Until that key exists
 * the route refuses every post, because an unsigned event could mark any
 * message as anything.
 *
 * SendGrid allows only two event webhooks per account, so one webhook serves
 * all three products. Every email carries a "site" custom arg; this route
 * keeps the events for its own site and, when SENDGRID_EVENT_FANOUT lists
 * the other sites, re-posts the untouched body and signature headers to
 * them. Each site verifies the signature itself, so the forwarder is not
 * trusted. Forwarded posts carry x-sendgrid-fanout and are never forwarded
 * again.
 */

import { NextRequest, NextResponse } from "next/server";
import { recordEmailEvent } from "@/lib/messaging/email";
import { PRODUCT } from "@/lib/product";

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
  site?: string;
  sg_message_id?: string;
  sg_event_id?: string;
}

function fanoutTargets(): string[] {
  return (process.env.SENDGRID_EVENT_FANOUT ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter((s) => s.startsWith("http") && s !== PRODUCT.siteUrl);
}

export async function POST(request: NextRequest) {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "SENDGRID_WEBHOOK_PUBLIC_KEY is not set" }, { status: 401 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-twilio-email-event-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-twilio-email-event-webhook-timestamp") ?? "";

  // A missing or malformed signature makes the verifier throw; that is a refusal, not a crash.
  let valid = false;
  try {
    const { EventWebhook } = await import("@sendgrid/eventwebhook");
    const verifier = new EventWebhook();
    const key = verifier.convertPublicKeyToECDSA(publicKey);
    valid = Boolean(signature && timestamp && verifier.verifySignature(key, rawBody, signature, timestamp));
  } catch {
    valid = false;
  }
  if (!valid) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let events: SendGridEvent[];
  try {
    events = JSON.parse(rawBody);
    if (!Array.isArray(events)) throw new Error("not an array");
  } catch {
    return NextResponse.json({ error: "body is not a JSON array" }, { status: 400 });
  }

  const forwarded = request.headers.get("x-sendgrid-fanout") === "1";
  let forwardedTo = 0;
  if (!forwarded) {
    for (const target of fanoutTargets()) {
      try {
        await fetch(`${target}/api/sendgrid/events`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-twilio-email-event-webhook-signature": signature,
            "x-twilio-email-event-webhook-timestamp": timestamp,
            "x-sendgrid-fanout": "1",
          },
          body: rawBody,
        });
        forwardedTo += 1;
      } catch {
        /* The other site is down; SendGrid retries the whole batch on a non-2xx, so say nothing here. */
      }
    }
  }

  let applied = 0;
  for (const e of events) {
    // Mine if tagged with my site, or untagged and delivered to me directly (emails sent before the tag existed).
    const mine = e.site ? e.site.replace(/\/$/, "") === PRODUCT.siteUrl : !forwarded;
    if (!mine) continue;
    const id = Number(e.message_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    await recordEmailEvent(id, e.event, new Date((e.timestamp ?? Date.now() / 1000) * 1000), {
      reason: e.reason ?? e.status ?? undefined,
      url: e.url ?? undefined,
      sg_event_id: e.sg_event_id ?? undefined,
    });
    applied += 1;
  }
  return NextResponse.json({ received: events.length, applied, forwarded_to: forwardedTo });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "sendgrid event webhook", configured: Boolean(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY) });
}
