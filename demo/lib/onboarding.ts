/**
 * Onboarding state and the automation around it.
 *
 * Each step saves a slice of the tenant's configuration. Starting the setup
 * sends the welcome email and schedules two "finish your setup" nudges that
 * cancel themselves once it is done. Going live activates the tenant, sends
 * the "your number is live" email, and schedules the day-3 check-in and the
 * day-7 report.
 *
 * Copied and adapted across the three products; the step forms differ.
 */

import { createElement } from "react";
import { FinishSetup, FirstCallCheckIn, NumberLive, WeeklyReport, Welcome } from "@/emails/Onboarding";
import { q } from "./db";
import { enqueue, registerJob, type Job } from "./jobs";
import { sendEmail } from "./messaging/email";
import { forwardingInstructions } from "./provision";
import { weekStats } from "./stats";
import { getTenant, listMemberships, updateTenant, type Tenant } from "./tenancy";
import { ONBOARDING_STEPS, configOf, type StepId, type TenantConfig } from "./tenant-config";

export function stepIndex(id: StepId): number {
  return ONBOARDING_STEPS.findIndex((s) => s.id === id);
}

export function stepById(id: string): (typeof ONBOARDING_STEPS)[number] | undefined {
  return ONBOARDING_STEPS.find((s) => s.id === id);
}

/** Merges a patch into tenants.config and advances the step counter. */
export async function saveConfig(tenantId: string, patch: Record<string, unknown>, reachedStep?: number): Promise<void> {
  await q(`update tenants set config = config || $2::jsonb, updated_at = now() where id = $1`, [tenantId, JSON.stringify(patch)]);
  if (reachedStep !== undefined) {
    await q(
      `update tenants
          set config = jsonb_set(config, '{onboarding,step}', to_jsonb(greatest(coalesce((config->'onboarding'->>'step')::int, 0), $2::int)), true),
              updated_at = now()
        where id = $1`,
      [tenantId, reachedStep],
    );
  }
}

async function ownerOf(t: Tenant): Promise<{ email: string; firstName: string } | null> {
  const members = await listMemberships(t.id);
  const owner = members.find((m) => m.role === "owner") ?? members[0];
  if (!owner) return null;
  return { email: owner.email, firstName: (owner.name || owner.email).split(/[\s@]/)[0] || "there" };
}

/** First visit to the setup: welcome email and the two nudges. Idempotent. */
export async function markStarted(t: Tenant): Promise<void> {
  const c = configOf(t);
  if (c.onboarding.startedAt) return;
  const startedAt = new Date().toISOString();
  await saveConfig(t.id, { onboarding: { ...c.onboarding, startedAt } });
  const owner = await ownerOf(t);
  if (!owner) return;
  await sendEmail({ to: owner.email, subject: `Welcome to ${t.name}'s workspace`, template: "onboarding_welcome", tenantId: t.id, react: createElement(Welcome, { firstName: owner.firstName, businessName: t.name }) });
  for (const hours of [24, 72]) {
    await enqueue("onboarding_nudge", { tenant_id: t.id, hours }, new Date(Date.now() + hours * 60 * 60_000), { tenantId: t.id });
  }
}

/** The customer has finished: activate, tell them, and start the first-week sequence. */
export async function goLive(tenantId: string): Promise<void> {
  const t = await getTenant(tenantId);
  if (!t) throw new Error("tenant not found");
  const c = configOf(t);
  if (!c.agent.agentId) throw new Error("The assistant has not been published yet.");
  const completedAt = c.onboarding.completedAt ?? new Date().toISOString();
  await saveConfig(t.id, { onboarding: { ...c.onboarding, completedAt, step: ONBOARDING_STEPS.length } });
  await updateTenant(t.id, { status: "active" });
  await q(`update jobs set status = 'cancelled', finished_at = now() where tenant_id = $1 and kind = 'onboarding_nudge' and status = 'queued'`, [t.id]);

  const owner = await ownerOf(t);
  if (!owner) return;
  if (!c.onboarding.completedAt) {
    const number = c.phone.number || t.phone_number || "";
    const forwarding = c.phone.mode === "forward" && number ? forwardingInstructions(c.phone.carrier, number) : [];
    if (number) {
      await sendEmail({ to: owner.email, subject: `Your assistant answers on ${number}`, template: "onboarding_number_live", tenantId: t.id, react: createElement(NumberLive, { firstName: owner.firstName, number, forwarding }) });
    }
    await enqueue("tenant_lifecycle", { tenant_id: t.id, kind: "day3" }, new Date(Date.now() + 3 * 24 * 60 * 60_000), { tenantId: t.id });
    await enqueue("tenant_lifecycle", { tenant_id: t.id, kind: "day7" }, new Date(Date.now() + 7 * 24 * 60 * 60_000), { tenantId: t.id });
  }
}

/* ------------------------------------------------------------------ jobs */

async function runNudge(job: Job): Promise<string> {
  const t = await getTenant(String(job.payload.tenant_id));
  if (!t) return "tenant missing";
  const c = configOf(t);
  if (c.onboarding.completedAt) return "setup complete, nudge not needed";
  if (t.status === "suspended") return "tenant suspended";
  const owner = await ownerOf(t);
  if (!owner) return "no owner";
  const step = Math.min(c.onboarding.step, ONBOARDING_STEPS.length - 1);
  const hours = Number(job.payload.hours) || 24;
  const sent = await sendEmail({
    to: owner.email,
    subject: hours >= 48 ? `Still ${ONBOARDING_STEPS.length - step} steps to go on your ${t.name} setup` : `Your ${t.name} setup is waiting`,
    template: `onboarding_nudge_${hours}h`,
    tenantId: t.id,
    react: createElement(FinishSetup, { firstName: owner.firstName, step, stepTitle: ONBOARDING_STEPS[step].title, hoursSince: hours }),
  });
  if (sent.status === "failed") throw new Error(sent.error ?? "send failed");
  return `${sent.provider}: nudge ${sent.status}`;
}

async function runLifecycle(job: Job): Promise<string> {
  const t = await getTenant(String(job.payload.tenant_id));
  if (!t) return "tenant missing";
  if (t.status !== "active") return `tenant is ${t.status}`;
  const owner = await ownerOf(t);
  if (!owner) return "no owner";
  const kind = String(job.payload.kind);
  const stats = await weekStats(t.id);
  const sent =
    kind === "day3"
      ? await sendEmail({ to: owner.email, subject: "How did the first calls go?", template: "lifecycle_day3", tenantId: t.id, react: createElement(FirstCallCheckIn, { firstName: owner.firstName, calls: stats.calls }) })
      : await sendEmail({ to: owner.email, subject: `Your first week: ${stats.lines.map((l) => `${l.value} ${l.label.toLowerCase()}`).slice(0, 2).join(", ")}`, template: "lifecycle_day7", tenantId: t.id, react: createElement(WeeklyReport, { firstName: owner.firstName, stats }) });
  if (sent.status === "failed") throw new Error(sent.error ?? "send failed");
  return `${sent.provider}: ${kind} ${sent.status}`;
}

registerJob("onboarding_nudge", runNudge);
registerJob("tenant_lifecycle", runLifecycle);

export type { TenantConfig };
