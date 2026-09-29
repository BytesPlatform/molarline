/**
 * Twilio's inbound SMS webhook: STOP, START and HELP handling. Dormant
 * until Twilio is connected; with TWILIO_AUTH_TOKEN set the signature is
 * required. The tenant is the one whose number the text was sent to.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { allowRate } from "@/lib/ratelimit";
import { recordSmsConsent, stopKeyword } from "@/lib/sms";
import { withTenant, type Tenant } from "@/lib/tenancy";
import { PRODUCT } from "@/lib/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function twiml(message?: string): NextResponse {
  const body = message ? `<Response><Message>${message}</Message></Response>` : "<Response></Response>";
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { "content-type": "text/xml" },
  });
}

/** Twilio's scheme: base64 HMAC-SHA1 of the URL plus the sorted form fields. */
function validSignature(url: string, params: Record<string, string>, signature: string | null, token: string): boolean {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", token).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function tenantByNumber(to: string): Promise<Tenant | null> {
  const digits = to.replace(/\D/g, "");
  if (!digits) return null;
  const rows = await q<Tenant>(
    `select * from tenants where regexp_replace(coalesce(phone_number, ''), '\\D', '', 'g') = $1 limit 1`,
    [digits],
  );
  return rows[0] ?? null;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  const token = process.env.TWILIO_AUTH_TOKEN;
  if (token) {
    const url = `${request.nextUrl.protocol}//${request.nextUrl.host}${request.nextUrl.pathname}`;
    if (!validSignature(url, params, request.headers.get("x-twilio-signature"), token)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  const from = params.From ?? "";
  const to = params.To ?? "";
  const body = params.Body ?? "";
  if (!from) return twiml();
  // A chatty or hostile number gets silence, not a database workout.
  if (!(await allowRate(`sms:${from}`, 8, 10))) return twiml();

  const tenant = await tenantByNumber(to);
  if (!tenant) return twiml();

  return withTenant(tenant, async () => {
    const keyword = stopKeyword(body);
    if (keyword === "stop") {
      await recordSmsConsent({ phone: from, kind: "sms_opt_out", source: "inbound_sms" });
      return twiml(`${tenant.short_name}: you are opted out and will get no more texts. Reply START to opt back in.`);
    }
    if (keyword === "start") {
      await recordSmsConsent({ phone: from, kind: "sms_opt_in", source: "inbound_sms" });
      return twiml(`${tenant.short_name}: you are opted back in. Reply STOP at any time to opt out.`);
    }
    if (keyword === "help") {
      return twiml(`${tenant.short_name} uses ${PRODUCT.name} for booking texts. Call ${tenant.main_number || "the office"} for help, or reply STOP to opt out.`);
    }
    // An ordinary reply is not a conversation we hold; the office phone is.
    return twiml();
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "twilio inbound sms webhook" });
}
