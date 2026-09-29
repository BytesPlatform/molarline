/**
 * What onboarding collects for a dental practice, and how the rest of the
 * product reads it.
 *
 * Everything a practice tells us lives in tenants.config as one JSON
 * document, typed here. cfg() returns the effective configuration for the
 * tenant in scope: the practice's answers merged over the product defaults
 * in config.ts, which is also exactly what the demo tenant runs on. The
 * tools, the schedule, the state route and the agent renderer all read from
 * cfg(), so a change made in onboarding or Settings is what the assistant
 * does on the next call.
 */

import {
  APPOINTMENT_TYPES,
  INSURANCE_ACCEPTED,
  LOCATIONS,
  OPERATORIES,
  PRACTICE,
  PROVIDERS,
  type AppointmentType,
  type Location,
  type Operatory,
  type Provider,
} from "./config";
import { tenant, tenantInScope, type Tenant } from "./tenancy";

export const ONBOARDING_STEPS = [
  { id: "account", title: "Account", blurb: "Your practice name, time zone and who else needs access." },
  { id: "business", title: "Offices and hours", blurb: "Each office, its address, phone, hours and parking, and the number the assistant gives out." },
  { id: "services", title: "What you do", blurb: "Providers and what they do, appointment types and lengths, insurance accepted, the new-patient policy." },
  { id: "behaviour", title: "How it should behave", blurb: "The greeting with the recording notice, the tone, what it says when it cannot help, and the front desk transfer." },
  { id: "software", title: "Calendar and software", blurb: "The built-in schedule, or the practice software you already run." },
  { id: "phone", title: "Phone number", blurb: "A new number in your area code, or forward the one you have." },
  { id: "test", title: "Test call", blurb: "Call your assistant from the browser and tick the checklist." },
  { id: "live", title: "Go live", blurb: "The summary, what to tell staff, and the forwarding step." },
] as const;

export type StepId = (typeof ONBOARDING_STEPS)[number]["id"];

export interface TenantConfig {
  onboarding: { step: number; startedAt: string | null; completedAt: string | null; checklist: Record<string, boolean>; testCallId: string | null };
  basics: {
    website: string;
    timezone: string;
    /** The number the assistant reads out for callbacks. */
    callbackNumber: string;
    /** What the assistant does outside every office's hours: book into the next open day, or take a message. */
    afterHoursPolicy: "book" | "message";
  };
  offices: Location[];
  providers: Provider[];
  operatories: Operatory[];
  appointmentTypes: AppointmentType[];
  insurance: string[];
  /** One or two sentences the assistant uses when a new patient calls. */
  newPatientPolicy: string;
  behaviour: {
    greeting: string;
    tone: "calm" | "friendly";
    cannotHelp: string;
    /** E.164, the front desk for "speak to a person". */
    transferNumber: string;
    takeMessageWhenUnanswered: boolean;
  };
  software: {
    calendar: "builtin" | "google" | "microsoft";
    pms: "none" | "dentrix" | "opendental" | "eaglesoft" | "curve" | "other";
    note: string;
  };
  phone: { mode: "buy" | "forward" | null; areaCode: string; number: string; existingNumber: string; carrier: string };
  agent: { flowId: string | null; agentId: string | null; version: number | null; publishedAt: string | null; renderedHash: string | null; voiceId: string | null };
}

export function defaultConfig(): TenantConfig {
  return {
    onboarding: { step: 0, startedAt: null, completedAt: null, checklist: {}, testCallId: null },
    basics: { website: "", timezone: PRACTICE.timezone, callbackNumber: PRACTICE.callbackNumber, afterHoursPolicy: "book" },
    offices: LOCATIONS.map((l) => ({ ...l })),
    providers: PROVIDERS.map((p) => ({ ...p })),
    operatories: OPERATORIES.map((o) => ({ ...o })),
    appointmentTypes: APPOINTMENT_TYPES.map((t) => ({ ...t, providerIds: [...t.providerIds] })),
    insurance: [...INSURANCE_ACCEPTED],
    newPatientPolicy: "New patients are welcome. The first visit is a new patient exam, and we ask you to arrive ten minutes early for paperwork.",
    behaviour: {
      greeting: `Thanks for calling ${PRACTICE.name}. You're speaking with our automated assistant, and this call is recorded for quality. Say staff at any time to reach a person. How can I help?`,
      tone: "friendly",
      cannotHelp: "That's one for the front desk. I'll pass it along and someone will call you back.",
      transferNumber: "",
      takeMessageWhenUnanswered: true,
    },
    software: { calendar: "builtin", pms: "none", note: "" },
    phone: { mode: null, areaCode: "", number: "", existingNumber: "", carrier: "" },
    agent: { flowId: null, agentId: null, version: null, publishedAt: null, renderedHash: null, voiceId: null },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Practice answers over defaults. Arrays are replaced whole, objects merged. */
export function mergeConfig(base: TenantConfig, patch: unknown): TenantConfig {
  if (!isObject(patch)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = (out as Record<string, unknown>)[k];
    out[k] = isObject(cur) && isObject(v) ? mergeConfig(cur as unknown as TenantConfig, v) : v;
  }
  return out as unknown as TenantConfig;
}

export function configOf(t: Tenant): TenantConfig {
  const c = mergeConfig(defaultConfig(), t.config);
  if (t.retell_agent_id && !c.agent.agentId) c.agent.agentId = t.retell_agent_id;
  if (t.phone_number && !c.phone.number) c.phone.number = t.phone_number;
  return c;
}

export function cfg(): TenantConfig {
  return tenantInScope() ? configOf(tenant()) : defaultConfig();
}

/* -------------------------------------------------------------- lookups */

export function providerByIdFor(c: TenantConfig, id: string): Provider | undefined {
  return c.providers.find((p) => p.id === id);
}

export function appointmentTypeByIdFor(c: TenantConfig, id: string): AppointmentType | undefined {
  return c.appointmentTypes.find((t) => t.id === id);
}

export function officeByIdFor(c: TenantConfig, id: string): Location | undefined {
  return c.offices.find((l) => l.id === id);
}

/** Matches "downtown", "the Downtown office" or an office id to an office; the first office when unsure. */
export function resolveOfficeFor(c: TenantConfig, raw: unknown): string {
  const text = String(raw ?? "").toLowerCase();
  const hit = c.offices.find((l) => text.includes(l.id) || text.includes(l.name.toLowerCase()));
  return hit?.id ?? c.offices[0]?.id ?? "downtown";
}

/** Two chairs per office, so a practice that never edits operatories still has a schedule. */
export function operatoriesFor(c: TenantConfig): Operatory[] {
  const mine = c.operatories.filter((o) => c.offices.some((l) => l.id === o.locationId));
  const missing = c.offices.filter((l) => !mine.some((o) => o.locationId === l.id));
  return [...mine, ...missing.flatMap((l) => [1, 2].map((n) => ({ id: `op_${l.id}_${n}`, name: `Op ${n}`, locationId: l.id })))];
}

/* ------------------------------------------------------ spoken summaries */

export function officesSummary(c: TenantConfig): string {
  return c.offices
    .map((l, i) => `${i + 1}. ${l.name}. ${l.address}. Phone ${l.phone}. Hours ${l.hours}.${l.parking ? ` Parking: ${l.parking}.` : ""}`)
    .join("\n");
}

export function providersSummary(c: TenantConfig): string {
  return c.providers.map((p) => `${p.name} (${p.title.toLowerCase()}, ${officeByIdFor(c, p.locationId)?.name ?? p.locationId})`).join(", ");
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

export function appointmentTypesSummary(c: TenantConfig): string {
  return c.appointmentTypes
    .map((t) => `- ${t.name}, ${t.minutes} minutes, with ${listNames(t.providerIds.map((id) => providerByIdFor(c, id)?.name ?? id))}.`)
    .join("\n");
}

/** What is still missing before the assistant can go live, in the practice's words. */
export function readiness(c: TenantConfig): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!c.basics.callbackNumber.trim()) missing.push("the number the assistant gives out");
  if (!c.offices.length) missing.push("at least one office");
  if (!c.providers.length) missing.push("at least one provider");
  if (!c.appointmentTypes.length) missing.push("at least one appointment type");
  if (c.appointmentTypes.some((t) => !t.providerIds.length)) missing.push("a provider for every appointment type");
  if (!c.behaviour.greeting.trim()) missing.push("the greeting");
  if (!/record/i.test(c.behaviour.greeting)) missing.push("a recording notice in the greeting");
  if (!/assistant|automated/i.test(c.behaviour.greeting)) missing.push("the greeting must say the caller is speaking with an assistant");
  return { ok: missing.length === 0, missing };
}

export function onboardingComplete(c: TenantConfig): boolean {
  return Boolean(c.onboarding.completedAt);
}
