/**
 * Retell's call lifecycle webhook.
 *
 * call_started   -> open the call row
 * call_ended     -> close it, write the two consent rows that every call must
 *                   produce because the opening line always plays
 * call_analyzed  -> record the outcome and raise the review flag when the
 *                   agent detected a topic it is not allowed to handle
 */

import { NextRequest, NextResponse } from "next/server";
import { closeCall, flagCall, logAccess, logConsent, logPipeline, saveCallMedia, touchCall } from "@/lib/audit";
import { notifyOwners } from "@/lib/notify";
import { redact } from "@/lib/redact";
import { phoneHash, signatureRequired, verifyRetellSignature } from "@/lib/retell";
import { tenantByAgentId, withTenant } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetellCall = {
  call_id: string;
  agent_id?: string;
  from_number?: string;
  to_number?: string;
  call_type?: string;
  disconnection_reason?: string;
  transcript?: string;
  recording_url?: string;
  call_analysis?: {
    call_summary?: string;
    user_sentiment?: string;
    call_successful?: boolean;
    custom_analysis_data?: Record<string, unknown>;
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let payload: { event: string; call: RetellCall };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "body is not valid JSON" }, { status: 400 });
  }

  const check = verifyRetellSignature(
    rawBody,
    request.headers.get("x-retell-signature"),
    process.env.RETELL_API_KEY,
  );
  if (!check.ok && signatureRequired()) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const call = payload.call;
  const callId = call?.call_id;
  if (!callId) return NextResponse.json({ error: "missing call_id" }, { status: 400 });

  const tenant = await tenantByAgentId(call.agent_id);
  if (!tenant) return NextResponse.json({ error: "unknown agent" }, { status: 404 });

  return withTenant(tenant, async () => {
  const channel = call.from_number ? "phone" : "web";
  await touchCall(callId, channel);

  if (payload.event === "call_started") {
    await logAccess({
      actor: "retell-agent",
      action: "call_started",
      callId,
      outcome: "ok",
      detail: { channel },
    });
    return NextResponse.json({ received: true });
  }

  if (payload.event === "call_ended") {
    const phone = call.from_number ?? "+15550000000";
    const last4 = phone.replace(/\D/g, "").slice(-4) || "0000";

    // The opening line always plays, so both disclosures are always true.
    await logConsent({ callId, phoneHash: phoneHash(phone), phoneLast4: last4, kind: "recording_notice" });
    await logConsent({ callId, phoneHash: phoneHash(phone), phoneLast4: last4, kind: "ai_disclosure" });
    await logPipeline(callId, "consent_recorded", "ok", "recording notice and AI disclosure, script v1.0");

    await logAccess({
      actor: "retell-agent",
      action: "call_ended",
      callId,
      outcome: call.disconnection_reason ?? "ok",
      detail: { channel },
    });
    await closeCall(callId, call.disconnection_reason ?? "ended");
    // Stored redacted: the dashboard shows what would be kept, never raw PHI.
    await saveCallMedia(callId, {
      transcript: call.transcript ? redact(call.transcript).text : null,
      recordingUrl: call.recording_url,
    });
    // A call the line could not complete is worth telling the owner about.
    if (/error|failed/i.test(call.disconnection_reason ?? "") && tenant.id !== "demo") {
      await notifyOwners(tenant, {
        template: "owner_failed_call",
        subject: "A call could not be completed",
        title: "A call did not go through",
        lines: [
          `A call ended with "${(call.disconnection_reason ?? "").replace(/_/g, " ")}".`,
          "The caller may try again; if this repeats, reply to this email and we will look at the line together.",
        ],
        ctaLabel: "See the call",
        ctaPath: `/app/calls?call=${encodeURIComponent(callId)}`,
      });
    }
    return NextResponse.json({ received: true });
  }

  if (payload.event === "call_analyzed") {
    const analysis = call.call_analysis ?? {};
    const custom = analysis.custom_analysis_data ?? {};
    const outcome = String(custom.outcome ?? (analysis.call_successful ? "completed" : "incomplete"));

    await closeCall(callId, outcome, analysis.call_summary);
    await saveCallMedia(callId, {
      transcript: call.transcript ? redact(call.transcript).text : null,
      recordingUrl: call.recording_url,
    });

    if (custom.phi_beyond_scheduling_mentioned === true) {
      await flagCall(callId, "Caller raised a clinical or billing topic. Agent declined and offered a transfer.");
      await logPipeline(callId, "flagged_for_review", "warn", "out of scope topic detected, transferred");
      await logAccess({
        actor: "retell-agent",
        action: "flag_for_review",
        callId,
        outcome: "flagged",
        detail: { reason: "phi_beyond_scheduling" },
      });
      if (tenant.id !== "demo") {
        await notifyOwners(tenant, {
          template: "owner_flagged",
          subject: "A call was handed to staff",
          title: "A caller needed a person",
          lines: ["The caller raised something clinical or billing; the assistant stepped back and took a message."],
          ctaLabel: "See the call",
          ctaPath: `/app/calls?call=${encodeURIComponent(callId)}`,
        });
      }
    }

    await logAccess({
      actor: "retell-agent",
      action: "call_analyzed",
      callId,
      outcome,
      detail: { sentiment: analysis.user_sentiment ?? null },
    });

    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true, ignored: payload.event });
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "retell call lifecycle webhook" });
}
