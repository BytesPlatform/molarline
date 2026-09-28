/**
 * Prospects from the landing site.
 *
 * A lead is created by the Book a demo form. On creation: an email to our
 * sales inbox, an auto-reply to the prospect, and three follow-up jobs at
 * day 1, 3 and 7. Any status change away from "new" cancels the follow-ups,
 * so a salesperson marking the lead contacted is what stops the sequence.
 *
 * Copied and adapted across the three products. Keep the file name.
 */

import { createElement } from "react";
import { createHmac } from "node:crypto";
import LeadAutoReply from "@/emails/LeadAutoReply";
import LeadFollowUp, { followUpSubject, type FollowUpStep } from "@/emails/LeadFollowUp";
import LeadNotification from "@/emails/LeadNotification";
import { q } from "./db";
import { cancelLeadJobs, enqueue, registerJob, type Job } from "./jobs";
import { sendEmail } from "./messaging/email";
import { PRODUCT } from "./product";
import { addMembership, createTenant, type Tenant } from "./tenancy";

export type LeadStatus = "new" | "contacted" | "booked" | "converted" | "closed";

export interface Lead {
  id: number;
  created_at: string;
  updated_at: string;
  source: string;
  name: string;
  business: string | null;
  email: string;
  phone: string;
  message: string | null;
  consent_contact: boolean;
  consent_at: string | null;
  consent_text: string | null;
  status: LeadStatus;
  tenant_id: string | null;
  sequence_stopped_at: string | null;
  notes: string | null;
}

const COLUMNS = `id, created_at, updated_at, source, name, business, email, phone, message, consent_contact, consent_at,
  consent_text, status, tenant_id, sequence_stopped_at, notes`;

/** Day 1, day 3, day 7 after the request. Overridable for tests. */
export const FOLLOW_UP_DAYS: Record<FollowUpStep, number> = { 1: 1, 2: 3, 3: 7 };

export function e164(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

export function ipHash(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.PATIENT_HASH_SALT || "demo-salt-change-me";
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 16);
}

export async function createLead(input: {
  name: string;
  business?: string | null;
  email: string;
  phone: string;
  message?: string | null;
  consent: boolean;
  source?: string;
  ip?: string | null;
  userAgent?: string | null;
  /** Milliseconds between follow-up steps, for tests. Defaults to days. */
  followUpMs?: Record<FollowUpStep, number>;
}): Promise<{ lead: Lead; notification: number; autoReply: number; jobs: number[] }> {
  const rows = await q<Lead>(
    `insert into leads (source, name, business, email, phone, message, consent_contact, consent_at, consent_text, ip_hash, user_agent)
     values ($1,$2,$3,lower($4),$5,$6,$7, case when $7 then now() else null end, case when $7 then $8 else null end, $9, $10)
     returning ${COLUMNS}`,
    [
      input.source ?? "book_demo",
      input.name.trim(),
      input.business?.trim() || null,
      input.email.trim(),
      input.phone,
      input.message?.trim() || null,
      input.consent,
      PRODUCT.consentText,
      ipHash(input.ip ?? null),
      input.userAgent?.slice(0, 300) ?? null,
    ],
  );
  const lead = rows[0];
  const firstName = firstNameOf(lead.name);

  const notification = await sendEmail({
    to: PRODUCT.salesInbox,
    subject: `Demo request: ${lead.name}${lead.business ? `, ${lead.business}` : ""}`,
    template: "lead_notification",
    leadId: lead.id,
    replyTo: lead.email,
    react: createElement(LeadNotification, {
      leadId: lead.id,
      name: lead.name,
      business: lead.business,
      email: lead.email,
      phone: lead.phone,
      message: lead.message,
      consent: lead.consent_contact,
      receivedAt: new Date(lead.created_at).toUTCString(),
    }),
  });

  const autoReply = await sendEmail({
    to: lead.email,
    subject: `Thanks ${firstName}, we will call you shortly`,
    template: "lead_auto_reply",
    leadId: lead.id,
    react: createElement(LeadAutoReply, { firstName }),
  });

  const jobs: number[] = [];
  for (const step of [1, 2, 3] as FollowUpStep[]) {
    const delay = input.followUpMs?.[step] ?? FOLLOW_UP_DAYS[step] * 24 * 60 * 60_000;
    jobs.push(await enqueue("lead_followup", { lead_id: lead.id, step }, new Date(Date.now() + delay), { leadId: lead.id }));
  }

  return { lead, notification: notification.id, autoReply: autoReply.id, jobs };
}

export async function getLead(id: number): Promise<Lead | null> {
  const rows = await q<Lead>(`select ${COLUMNS} from leads where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listLeads(limit = 100): Promise<Lead[]> {
  return q<Lead>(`select ${COLUMNS} from leads order by created_at desc limit $1`, [limit]);
}

export async function leadCounts(): Promise<{ new_leads: number; total: number }> {
  const rows = await q<{ new_leads: number; total: number }>(
    `select (select count(*)::int from leads where status = 'new') as new_leads, (select count(*)::int from leads) as total`,
  );
  return rows[0];
}

/** Any status other than "new" ends the follow-up sequence. */
export async function setLeadStatus(id: number, status: LeadStatus, notes?: string | null): Promise<void> {
  await q(
    `update leads
        set status = $2,
            notes = coalesce($3, notes),
            sequence_stopped_at = case when $2 <> 'new' then coalesce(sequence_stopped_at, now()) else null end,
            updated_at = now()
      where id = $1`,
    [id, status, notes ?? null],
  );
  if (status !== "new") await cancelLeadJobs(id);
}

export async function setLeadNotes(id: number, notes: string): Promise<void> {
  await q(`update leads set notes = $2, updated_at = now() where id = $1`, [id, notes]);
}

/**
 * After the demo call: one click makes the prospect a customer. Creates the
 * tenant, adds the prospect as its owner, and links the lead to it. The
 * invitation is sent from the tenant page, where the failure is visible.
 */
export async function convertLead(id: number, input: { name?: string; shortName?: string; plan?: string; includedMinutes?: number }): Promise<Tenant> {
  const lead = await getLead(id);
  if (!lead) throw new Error("lead not found");
  if (lead.tenant_id) {
    const rows = await q<Tenant>(`select * from tenants where id = $1`, [lead.tenant_id]);
    if (rows[0]) return rows[0];
  }
  const tenant = await createTenant({
    name: input.name || lead.business || lead.name,
    shortName: input.shortName,
    mainNumber: lead.phone,
    plan: input.plan,
    includedMinutes: input.includedMinutes,
  });
  await addMembership({ tenantId: tenant.id, email: lead.email, name: lead.name, role: "owner" });
  await q(`update leads set tenant_id = $2, status = 'converted', sequence_stopped_at = coalesce(sequence_stopped_at, now()), updated_at = now() where id = $1`, [
    id,
    tenant.id,
  ]);
  await cancelLeadJobs(id);
  return tenant;
}

/* ------------------------------------------------------------ the job */

async function runFollowUp(job: Job): Promise<string> {
  const leadId = Number(job.payload.lead_id);
  const step = Number(job.payload.step) as FollowUpStep;
  const lead = await getLead(leadId);
  if (!lead) return "lead missing, skipped";
  if (lead.status !== "new" || lead.sequence_stopped_at) return `lead is ${lead.status}, sequence stopped`;
  if (!lead.consent_contact) return "no consent to contact, skipped";

  const firstName = firstNameOf(lead.name);
  const sent = await sendEmail({
    to: lead.email,
    subject: followUpSubject(step, firstName),
    template: `lead_followup_${step}`,
    leadId: lead.id,
    react: createElement(LeadFollowUp, { step, firstName }),
  });
  if (sent.status === "failed") throw new Error(sent.error ?? "send failed");
  return `${sent.provider}: step ${step} ${sent.status}`;
}

registerJob("lead_followup", runFollowUp);
