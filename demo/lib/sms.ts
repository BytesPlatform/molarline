/**
 * Texting: consent, STOP handling and the reminder sender.
 *
 * Twilio is not connected yet, so messages are written to the platform
 * messages table with provider preview; setting TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER makes the same function send.
 * A patient is only ever texted after an explicit opt-in on a call, and a
 * STOP reply wins over everything.
 */

import { q } from "./db";
import { logConsent } from "./audit";
import { phoneHash } from "./retell";
import { tenantId } from "./tenancy";

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export function smsMode(): "preview" | "twilio" {
  return smsConfigured() ? "twilio" : "preview";
}

/** The carrier keywords, per CTIA. Anything else is a normal reply. */
export function stopKeyword(body: string): "stop" | "start" | "help" | null {
  const word = body.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(word)) return "stop";
  if (["START", "YES", "UNSTOP"].includes(word)) return "start";
  if (word === "HELP") return "help";
  return null;
}

/**
 * One number, one hash: "(773) 555-0111" and "+17735550111" are the same
 * phone, so the US country code is dropped before hashing. Otherwise a
 * STOP recorded from Twilio's E.164 would not match the number we dial.
 */
export function smsHash(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return phoneHash(digits);
}

export async function isSuppressed(phone: string): Promise<boolean> {
  const rows = await q<{ ok: number }>(
    `select 1 as ok from suppression_list where tenant_id = $1 and phone_hash = $2`,
    [tenantId(), smsHash(phone)],
  );
  return rows.length > 0;
}

/** The latest word from this phone about texting. Nothing recorded means no. */
export async function hasSmsConsent(phone: string): Promise<boolean> {
  const rows = await q<{ kind: string }>(
    `select kind from consent_events
      where tenant_id = $1 and phone_hash = $2 and kind in ('sms_opt_in','sms_opt_out')
      order by id desc limit 1`,
    [tenantId(), smsHash(phone)],
  );
  return rows[0]?.kind === "sms_opt_in";
}

/**
 * Records the consent event and keeps the suppression list in step: an
 * opt-out lands on the list, an opt-in takes the number off it.
 */
export async function recordSmsConsent(args: {
  phone: string;
  kind: "sms_opt_in" | "sms_opt_out";
  source: string;
  callId?: string;
}): Promise<void> {
  const hash = smsHash(args.phone);
  const last4 = args.phone.replace(/\D/g, "").slice(-4) || "0000";
  await logConsent({
    callId: args.callId ?? "",
    phoneHash: hash,
    phoneLast4: last4,
    kind: args.kind,
    scriptVer: "v1.0",
    channel: args.source === "inbound_sms" ? "sms" : "voice",
  });
  if (args.kind === "sms_opt_out") {
    await q(
      `insert into suppression_list (tenant_id, phone_hash, source) values ($1,$2,$3)
       on conflict (tenant_id, phone_hash) do nothing`,
      [tenantId(), hash, args.source],
    );
  } else {
    await q(`delete from suppression_list where tenant_id = $1 and phone_hash = $2`, [tenantId(), hash]);
  }
}

async function sendViaTwilio(to: string, body: string): Promise<{ sid: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID as string;
  const token = process.env.TWILIO_AUTH_TOKEN as string;
  const from = process.env.TWILIO_FROM_NUMBER as string;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Twilio returned ${res.status}`);
  return { sid: json.sid ?? "" };
}

/**
 * Sends a patient text, honouring consent and STOP first. The row lands in
 * the platform messages table so the Advanced page shows it. The body must
 * carry nothing beyond date, time, provider and office.
 */
export async function sendSms(args: {
  to: string;
  body: string;
  template: string;
}): Promise<{ id: number; status: "queued" | "sent" | "failed" | "suppressed" | "no_consent" }> {
  if (!(await hasSmsConsent(args.to))) return { id: 0, status: "no_consent" };
  const provider = smsMode();
  if (await isSuppressed(args.to)) {
    const rows = await q<{ id: number }>(
      `insert into messages (tenant_id, channel, to_address, template, body_text, status, provider, error)
       values ($1,'sms',$2,$3,$4,'suppressed',$5,'the number opted out') returning id`,
      [tenantId(), args.to, args.template, args.body, provider],
    );
    return { id: rows[0]?.id ?? 0, status: "suppressed" };
  }
  const rows = await q<{ id: number }>(
    `insert into messages (tenant_id, channel, to_address, template, body_text, status, provider)
     values ($1,'sms',$2,$3,$4,'queued',$5) returning id`,
    [tenantId(), args.to, args.template, args.body, provider],
  );
  const id = rows[0]?.id ?? 0;
  if (provider === "twilio") {
    try {
      const { sid } = await sendViaTwilio(args.to, args.body);
      await q(`update messages set status = 'sent', provider_id = $2 where id = $1`, [id, sid]);
      return { id, status: "sent" };
    } catch (err) {
      await q(`update messages set status = 'failed', error = $2 where id = $1`, [id, err instanceof Error ? err.message : "unknown error"]);
      return { id, status: "failed" };
    }
  }
  return { id, status: "queued" };
}
