"use server";

/**
 * What each onboarding step saves for a dental practice. Every action
 * re-checks the session and writes only to the signed-in tenant. The same
 * actions back Settings.
 */

import { redirect } from "next/navigation";
import { requireTenant, requestOrigin, sendInvitation } from "@/lib/auth";
import { e164 } from "@/lib/leads";
import { goLive, saveConfig, stepIndex } from "@/lib/onboarding";
import { buyNumber, provisionAgent, releaseNumber } from "@/lib/provision";
import { addMembership, recordInvitation, updateTenant } from "@/lib/tenancy";
import { ONBOARDING_STEPS, configOf, type StepId } from "@/lib/tenant-config";
import type { AppointmentType, Location, Operatory, Provider } from "@/lib/config";

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function next(form: FormData, step: StepId): never {
  const mode = text(form, "mode");
  if (mode === "settings") redirect(`/app/settings?ok=${encodeURIComponent("Saved.")}#${step}`);
  const i = stepIndex(step);
  const target = ONBOARDING_STEPS[i + 1]?.id;
  redirect(target ? `/app/setup/${target}` : "/app");
}

function back(step: StepId, message: string, form?: FormData): never {
  const mode = form ? text(form, "mode") : "";
  redirect(mode === "settings" ? `/app/settings?error=${encodeURIComponent(message)}#${step}` : `/app/setup/${step}?error=${encodeURIComponent(message)}`);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "item";
}

/* 1 */
export async function saveAccountAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const name = text(form, "name");
  if (!name) back("account", "The practice name is required.", form);
  const c = configOf(ctx.tenant);
  await updateTenant(ctx.tenant.id, { name, short_name: text(form, "short_name") || name.split(/\s+/)[0], timezone: text(form, "timezone") || c.basics.timezone });
  await saveConfig(ctx.tenant.id, { basics: { ...c.basics, timezone: text(form, "timezone") || c.basics.timezone, website: text(form, "website") } }, 1);
  const invite = text(form, "invite_email").toLowerCase();
  if (invite) {
    const member = await addMembership({ tenantId: ctx.tenant.id, email: invite, name: text(form, "invite_name") || undefined, role: "staff" });
    const origin = await requestOrigin();
    await recordInvitation(member.id, await sendInvitation({ email: invite, tenantId: ctx.tenant.id, role: "staff", origin }));
  }
  next(form, "account");
}

/* 2: offices */
export async function saveBusinessAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const callback = text(form, "callback_number");
  if (!callback) back("business", "The number the assistant gives out is required.", form);
  const offices: Location[] = [];
  for (const line of text(form, "offices").split("\n")) {
    const [name, address, phone, hours, parking] = line.split("|").map((s) => s.trim());
    if (!name) continue;
    const existing = c.offices.find((l) => l.name.toLowerCase() === name.toLowerCase());
    offices.push({ id: existing?.id ?? slug(name), name, address: address || "", phone: phone || callback, hours: hours || "Monday to Friday 8:00 to 5:00", parking: parking || "" });
  }
  if (!offices.length) back("business", "Add at least one office.", form);
  // Keep providers and chairs that still point at an office; the rest will be re-entered on the next step.
  const providers: Provider[] = c.providers.filter((p) => offices.some((l) => l.id === p.locationId));
  const operatories: Operatory[] = c.operatories.filter((o) => offices.some((l) => l.id === o.locationId));
  for (const l of offices) if (!operatories.some((o) => o.locationId === l.id)) operatories.push({ id: `op_${l.id}_1`, name: "Op 1", locationId: l.id }, { id: `op_${l.id}_2`, name: "Op 2", locationId: l.id });
  await updateTenant(ctx.tenant.id, { main_number: callback });
  await saveConfig(ctx.tenant.id, { basics: { ...c.basics, callbackNumber: callback, afterHoursPolicy: text(form, "after_hours") === "message" ? "message" : "book" }, offices, providers, operatories }, 2);
  next(form, "business");
}

/* 3: providers, appointment types, insurance, new patients */
const TONES = ["teal", "plum", "amber", "slate"] as const;

export async function saveServicesAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);

  const providers: Provider[] = [];
  let i = 0;
  for (const line of text(form, "providers").split("\n")) {
    const [name, title, office] = line.split("|").map((s) => s.trim());
    if (!name) continue;
    const loc = c.offices.find((l) => l.name.toLowerCase() === (office || "").toLowerCase() || l.id === (office || "").toLowerCase()) ?? c.offices[0];
    if (!loc) back("services", "Add an office first.", form);
    providers.push({ id: `prov_${slug(name)}`, name, title: title || "General dentistry", tone: TONES[i++ % TONES.length], locationId: loc.id });
  }
  const appointmentTypes: AppointmentType[] = [];
  for (const line of text(form, "appointment_types").split("\n")) {
    const [name, minutes, who] = line.split("|").map((s) => s.trim());
    if (!name) continue;
    const wanted = (who || "").split(/[,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const providerIds = providers.filter((p) => !wanted.length || wanted.includes("any") || wanted.some((w) => p.name.toLowerCase().includes(w) || w.includes(p.name.toLowerCase().replace(/^(dr|ms|mr|mrs)\.?\s*/, "")))).map((p) => p.id);
    appointmentTypes.push({ id: slug(name), name, minutes: Math.max(10, Number(minutes) || 30), providerIds });
  }
  const insurance = text(form, "insurance").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const newPatientPolicy = text(form, "new_patient_policy") || c.newPatientPolicy;
  if (!providers.length) back("services", "Add at least one provider.", form);
  if (!appointmentTypes.length) back("services", "Add at least one appointment type.", form);
  const orphan = appointmentTypes.find((t) => !t.providerIds.length);
  if (orphan) back("services", `No provider matched "${orphan.name}". Use provider names as written above, or "any".`, form);
  await saveConfig(ctx.tenant.id, { providers, appointmentTypes, insurance, newPatientPolicy }, 3);
  next(form, "services");
}

/* 4 */
export async function saveBehaviourAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const greeting = text(form, "greeting");
  if (!greeting) back("behaviour", "The greeting is required.", form);
  if (!/record/i.test(greeting)) back("behaviour", "The greeting must tell the caller the call is recorded.", form);
  if (!/assistant|automated/i.test(greeting)) back("behaviour", "The greeting must say the caller is speaking with an assistant.", form);
  const transfer = text(form, "transfer_number");
  const transferE164 = transfer ? e164(transfer) : "";
  if (transfer && !transferE164) back("behaviour", "The front desk number does not look like a phone number.", form);
  await saveConfig(ctx.tenant.id, { behaviour: { ...c.behaviour, greeting, tone: text(form, "tone") === "calm" ? "calm" : "friendly", cannotHelp: text(form, "cannot_help") || c.behaviour.cannotHelp, transferNumber: transferE164 || "", takeMessageWhenUnanswered: form.get("take_message") === "on" } }, 4);
  next(form, "behaviour");
}

/* 5 */
export async function saveSoftwareAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const calendar = (["builtin", "google", "microsoft"].includes(text(form, "calendar")) ? text(form, "calendar") : "builtin") as "builtin" | "google" | "microsoft";
  const pms = (["none", "dentrix", "opendental", "eaglesoft", "curve", "other"].includes(text(form, "pms")) ? text(form, "pms") : "none") as TenantSoftware;
  await saveConfig(ctx.tenant.id, { software: { ...c.software, calendar, pms, note: text(form, "note").slice(0, 1000) } }, 5);
  next(form, "software");
}
type TenantSoftware = "none" | "dentrix" | "opendental" | "eaglesoft" | "curve" | "other";

/* 6 */
export async function publishAgentAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const step = (text(form, "step") || "phone") as StepId;
  try {
    const r = await provisionAgent(ctx.tenant.id);
    const mode = text(form, "mode");
    redirect(mode === "settings" ? `/app/settings?ok=${encodeURIComponent(`Assistant published, version ${r.version ?? "1"}.`)}` : `/app/setup/${step}?ok=${encodeURIComponent("Assistant published.")}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    back(step, err instanceof Error ? err.message : "Could not publish the assistant.", form);
  }
}

export async function buyNumberAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  try {
    const r = await buyNumber(ctx.tenant.id, text(form, "area_code"));
    await saveConfig(ctx.tenant.id, {}, 6);
    redirect(`/app/setup/phone?ok=${encodeURIComponent(`Your number is ${r.number}.`)}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    back("phone", err instanceof Error ? err.message : "Could not buy a number.", form);
  }
}

export async function forwardNumberAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const existing = e164(text(form, "existing_number"));
  if (!existing) back("phone", "Your current number does not look like a phone number.", form);
  await saveConfig(ctx.tenant.id, { phone: { ...c.phone, mode: "forward", existingNumber: existing, carrier: text(form, "carrier") } }, 6);
  redirect("/app/setup/phone?ok=" + encodeURIComponent("Forwarding chosen. Buy the number the calls will forward to, then follow the carrier steps below."));
}

export async function releaseNumberAction(): Promise<void> {
  const ctx = await requireTenant();
  await releaseNumber(ctx.tenant.id);
  redirect("/app/settings?ok=" + encodeURIComponent("Number released."));
}

/* 7 */
export async function saveChecklistAction(callId: string, checklist: Record<string, boolean>): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  await saveConfig(ctx.tenant.id, { onboarding: { ...c.onboarding, testCallId: callId, checklist: { ...c.onboarding.checklist, ...checklist } } }, 7);
}

export async function continueFromTestAction(): Promise<void> {
  const ctx = await requireTenant();
  await saveConfig(ctx.tenant.id, {}, 7);
  redirect("/app/setup/live");
}

/* 8 */
export async function goLiveAction(): Promise<void> {
  const ctx = await requireTenant();
  try {
    await goLive(ctx.tenant.id);
  } catch (err) {
    back("live", err instanceof Error ? err.message : "Could not go live.");
  }
  redirect("/app?ok=" + encodeURIComponent("You are live."));
}
