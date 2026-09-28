/**
 * Outbound email.
 *
 * One send() with one provider, SendGrid, behind it. Every email is a row in
 * the messages table first, then a send if SENDGRID_API_KEY exists. Without
 * the key the row is kept with status "preview" and the rendered text, so
 * the admin console shows exactly what would have gone out. That is how the
 * landing site can be built and tested before the SendGrid sender is set up.
 *
 * Delivery, open, click and bounce events arrive on /api/sendgrid/events and
 * update the same row, matched by the message id we pass as a custom arg.
 *
 * Copied and adapted across the three products. Keep the file name.
 */

import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { q } from "../db";
import { PRODUCT } from "../product";

export type EmailStatus = "preview" | "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "spam" | "failed";

export interface SendEmailInput {
  to: string;
  subject: string;
  template: string;
  react: ReactElement;
  leadId?: number | null;
  tenantId?: string | null;
  replyTo?: string;
}

export interface SentEmail {
  id: number;
  status: EmailStatus;
  provider: "preview" | "sendgrid";
  error?: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}

export function emailMode(): "preview" | "sendgrid" {
  return emailConfigured() ? "sendgrid" : "preview";
}

export async function sendEmail(input: SendEmailInput): Promise<SentEmail> {
  const html = await render(input.react);
  const text = await render(input.react, { plainText: true });
  const provider = emailMode();
  const from = `${PRODUCT.fromName} <${PRODUCT.fromEmail}>`;

  const rows = await q<{ id: number }>(
    `insert into messages (tenant_id, lead_id, channel, to_address, from_address, template, subject, body_text, status, provider)
     values ($1,$2,'email',$3,$4,$5,$6,$7,$8,$9) returning id`,
    [
      input.tenantId ?? null,
      input.leadId ?? null,
      input.to,
      from,
      input.template,
      input.subject,
      text,
      provider === "sendgrid" ? "queued" : "preview",
      provider,
    ],
  );
  const id = Number(rows[0]?.id ?? 0);

  if (provider === "preview") return { id, status: "preview", provider };

  try {
    const sg = (await import("@sendgrid/mail")).default;
    sg.setApiKey(process.env.SENDGRID_API_KEY as string);
    const [response] = await sg.send({
      to: input.to,
      from: { email: PRODUCT.fromEmail, name: PRODUCT.fromName },
      replyTo: input.replyTo ?? PRODUCT.salesInbox,
      subject: input.subject,
      html,
      text,
      // The site tag lets one SendGrid webhook serve all three products: the
      // receiving site keeps its own events and forwards the rest.
      customArgs: { message_id: String(id), site: PRODUCT.siteUrl },
      trackingSettings: { clickTracking: { enable: true, enableText: false }, openTracking: { enable: true } },
    });
    const providerId = String(response.headers?.["x-message-id"] ?? "");
    await q(`update messages set status = 'sent', provider_id = $2, updated_at = now() where id = $1`, [id, providerId || null]);
    return { id, status: "sent", provider };
  } catch (err) {
    const message =
      (err as { response?: { body?: { errors?: { message?: string }[] } } })?.response?.body?.errors?.[0]?.message ??
      (err instanceof Error ? err.message : "unknown error");
    await q(`update messages set status = 'failed', error = $2, updated_at = now() where id = $1`, [id, message.slice(0, 500)]);
    return { id, status: "failed", provider, error: message };
  }
}

/** The order events move a message through. A later status never regresses. */
const RANK: Record<string, number> = { preview: 0, queued: 1, sent: 2, delivered: 3, opened: 4, clicked: 5, bounced: 9, spam: 9, failed: 9 };

export function statusForEvent(event: string): EmailStatus | null {
  switch (event) {
    case "delivered":
      return "delivered";
    case "open":
      return "opened";
    case "click":
      return "clicked";
    case "bounce":
    case "dropped":
      return "bounced";
    case "spamreport":
      return "spam";
    default:
      return null;
  }
}

/** Applies one SendGrid event to its message row. Unknown ids are ignored. */
export async function recordEmailEvent(messageId: number, event: string, at: Date, detail: Record<string, unknown>): Promise<void> {
  const rows = await q<{ status: string }>(`select status from messages where id = $1`, [messageId]);
  if (!rows[0]) return;
  const next = statusForEvent(event);
  const current = rows[0].status;
  const status = next && (RANK[next] ?? 0) > (RANK[current] ?? 0) ? next : current;
  await q(
    `update messages
        set status = $2,
            events = events || $3::jsonb,
            error = case when $2 in ('bounced','spam') then coalesce($4, error) else error end,
            updated_at = now()
      where id = $1`,
    [messageId, status, JSON.stringify([{ event, at: at.toISOString(), ...detail }]), typeof detail.reason === "string" ? detail.reason : null],
  );
}
