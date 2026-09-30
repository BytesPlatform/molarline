/**
 * Onboarding state and the automation around it.
 *
 * Each step saves a slice of the tenant's configuration. Starting the setup
 * sends one welcome email; going live activates the tenant and sends the
 * "your number is live" note. A trial is short, so nothing else is
 * scheduled: a prospect who stops after two days hears nothing more.
 *
 * Copied and adapted across the three products; the step forms differ.
 */

import { createElement } from "react";
import { NumberLive, Welcome } from "@/emails/Onboarding";
import { q } from "./db";
import { sendEmail } from "./messaging/email";
import { forwardingInstructions } from "./provision";
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
  }
}

export type { TenantConfig };
