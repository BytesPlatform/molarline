/**
 * Turning a practice's configuration into a working assistant.
 *
 * The demo flow and agent in retell/ are the templates. renderFlow() and
 * renderAgent() fill them from the tenant's configuration: the greeting,
 * the office facts in the global prompt, the front desk number, the webhook
 * host, the boosted keywords. provisionAgent() creates or updates the
 * conversation flow and the agent on Retell, publishes them, and records
 * the ids on the tenant. buyNumber() buys a number in the practice's area
 * code and binds it to the agent.
 */

import { createHash } from "node:crypto";
import flowTemplate from "@/retell/demo-flow.json";
import agentTemplate from "@/retell/demo-agent.json";
import { q } from "./db";
import { PRODUCT } from "./product";
import { getTenant, updateTenant, type Tenant } from "./tenancy";
import { appointmentTypesSummary, configOf, officesSummary, providersSummary, readiness, type TenantConfig } from "./tenant-config";

const BASE_URL = process.env.RETELL_BASE_URL ?? "https://api.retellai.com";
const DEFAULT_VOICE = process.env.RETELL_VOICE_ID || "cartesia-Cleo";

export class RetellError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export async function retell<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.RETELL_API_KEY;
  if (!key) throw new RetellError("RETELL_API_KEY is not set on this deployment");
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new RetellError(`Retell ${method} ${path} failed with ${res.status}: ${text.slice(0, 300)}`, res.status);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export function siteHost(): string {
  return PRODUCT.siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function substituteAll(doc: unknown, values: Record<string, string>): any {
  let json = JSON.stringify(doc);
  for (const [tag, value] of Object.entries(values)) json = json.split(`<${tag}>`).join(value);
  return JSON.parse(json);
}

/** The office-facts half of the global prompt, rebuilt from the configuration. */
export function renderFacts(t: Tenant, c: TenantConfig): string {
  const n = c.appointmentTypes.length;
  const afterHours =
    c.basics.afterHoursPolicy === "book"
      ? "Outside office hours you still book into the next open day."
      : "Outside office hours you take a message for the front desk with take_message rather than booking.";
  return [
    `FACTS. Answer office questions from this list and nothing else.`,
    ``,
    `Practice: {{practice_name}}.${t.tagline ? ` ${t.tagline}.` : ""}`,
    ``,
    `Offices, ${c.offices.length === 1 ? "one" : c.offices.length}:`,
    officesSummary(c),
    afterHours,
    ``,
    `Providers: ${providersSummary(c)}.`,
    ``,
    `Appointment types you can book, with the time each one takes:`,
    appointmentTypesSummary(c),
    `Anything that is not one of these ${n === 1 ? "" : n + " "}goes to the front desk queue.`,
    ``,
    `New patients: ${c.newPatientPolicy}`,
    ``,
    c.insurance.length
      ? `Insurance carriers accepted: ${c.insurance.join(", ")}. When you answer any question about insurance, finish with exactly: "We'll verify your coverage before your visit." Never say whether a specific person's plan is active, what it covers, or what anything will cost them; that goes to staff.`
      : `Insurance questions go to the front desk; say "We'll verify your coverage before your visit" and offer a transfer.`,
    ``,
    `You may give out the practice callback number {{callback_number}}. Never give out a patient's phone number, address or email.`,
    c.behaviour.cannotHelp ? `When you cannot help with something, say: "${c.behaviour.cannotHelp}"` : "",
    c.behaviour.tone === "friendly" ? `TONE: warm and friendly, first names, a little reassurance. Still brief.` : `TONE: calm and professional. Brief, plain sentences.`,
    ``,
  ].join("\n");
}

/** The template's prompt with its demo facts block replaced by the tenant's. */
export function renderGlobalPrompt(t: Tenant, c: TenantConfig): string {
  const template = String((flowTemplate as { global_prompt: string }).global_prompt);
  const start = template.indexOf("FACTS");
  const end = template.indexOf("\n## ", start);
  const head = (start > 0 ? template.slice(0, start) : template).replace(" This is a demonstration system with invented patients; it holds no real patient records.", "");
  const tail = end > 0 ? template.slice(end + 1) : "";
  return `${head}${renderFacts(t, c)}\n${tail}`;
}

export function renderFlow(t: Tenant, c: TenantConfig): Record<string, unknown> {
  const doc = substituteAll(flowTemplate, { DEMO_HOST: siteHost(), ...(c.behaviour.transferNumber ? { FRONT_DESK_E164: c.behaviour.transferNumber } : {}) });
  doc.global_prompt = renderGlobalPrompt(t, c);
  doc.default_dynamic_variables = {
    ...(doc.default_dynamic_variables ?? {}),
    practice_name: t.name,
    callback_number: c.basics.callbackNumber || t.main_number || "",
    front_desk_number: c.behaviour.transferNumber || "<FRONT_DESK_E164>",
  };
  for (const node of doc.nodes as { id: string; instruction?: { type: string; text: string } }[]) {
    if (node.id === "n_opening" && node.instruction?.type === "static_text") node.instruction.text = c.behaviour.greeting;
    if (node.id === "n_end" && node.instruction?.type === "static_text") node.instruction.text = `Thanks for calling ${t.name}. Goodbye.`;
  }
  return doc;
}

export function renderAgent(t: Tenant, c: TenantConfig, flowId: string): Record<string, unknown> {
  const doc = substituteAll(agentTemplate, { DEMO_HOST: siteHost(), CONVERSATION_FLOW_ID: flowId, VOICE_ID: c.agent.voiceId || DEFAULT_VOICE });
  doc.agent_name = `${PRODUCT.name}: ${t.name}`;
  const base = (agentTemplate as { boosted_keywords?: string[] }).boosted_keywords ?? [];
  const generic = base.filter((k) => !/^[A-Z]/.test(k));
  const names = [...c.providers.map((p) => p.name), ...c.offices.map((l) => l.name), ...c.insurance, t.short_name];
  doc.boosted_keywords = [...new Set([...generic, ...names])].slice(0, 100);
  return doc;
}

export function renderedHash(flow: unknown, agent: unknown): string {
  return createHash("sha256").update(JSON.stringify([flow, agent])).digest("hex").slice(0, 16);
}

async function saveConfig(t: Tenant, patch: Record<string, unknown>): Promise<void> {
  await q(`update tenants set config = config || $2::jsonb, updated_at = now() where id = $1`, [t.id, JSON.stringify(patch)]);
}

export interface ProvisionResult {
  agentId: string;
  flowId: string;
  version: number | null;
  changed: boolean;
}

export async function provisionAgent(tenantId: string): Promise<ProvisionResult> {
  const t = await getTenant(tenantId);
  if (!t) throw new Error("tenant not found");
  const c = configOf(t);
  const ready = readiness(c);
  if (!ready.ok) throw new Error(`Not ready to publish: still missing ${ready.missing.join(", ")}.`);

  const flow = renderFlow(t, c);
  let flowId = c.agent.flowId;
  if (flowId) {
    await retell("PATCH", `/update-conversation-flow/${flowId}`, flow);
  } else {
    const res = await retell<{ conversation_flow_id: string }>("POST", "/create-conversation-flow", flow);
    flowId = res.conversation_flow_id;
  }

  const agent = renderAgent(t, c, flowId);
  let agentId = c.agent.agentId;
  let version: number | null = null;
  if (agentId) {
    const res = await retell<{ version?: number }>("PATCH", `/update-agent/${agentId}`, agent);
    version = res?.version ?? null;
  } else {
    const res = await retell<{ agent_id: string; version?: number }>("POST", "/create-agent", agent);
    agentId = res.agent_id;
    version = res?.version ?? null;
  }
  await retell("POST", `/publish-agent/${agentId}`);

  const hash = renderedHash(flow, agent);
  const changed = hash !== c.agent.renderedHash;
  await saveConfig(t, { agent: { ...c.agent, flowId, agentId, version, publishedAt: new Date().toISOString(), renderedHash: hash, voiceId: c.agent.voiceId || DEFAULT_VOICE } });
  await updateTenant(t.id, { retell_agent_id: agentId });
  return { agentId, flowId, version, changed };
}

export function needsRepublish(t: Tenant): boolean {
  const c = configOf(t);
  if (!c.agent.agentId || !c.agent.flowId) return true;
  return renderedHash(renderFlow(t, c), renderAgent(t, c, c.agent.flowId)) !== c.agent.renderedHash;
}

export interface NumberResult {
  number: string;
  nickname: string;
}

export async function buyNumber(tenantId: string, areaCode: string): Promise<NumberResult> {
  const t = await getTenant(tenantId);
  if (!t) throw new Error("tenant not found");
  const c = configOf(t);
  if (!c.agent.agentId) throw new Error("Publish the assistant before buying a number.");
  const code = areaCode.replace(/\D/g, "").slice(0, 3);
  if (code.length !== 3) throw new Error("Area code must be three digits.");
  const nickname = `${PRODUCT.name}: ${t.name}`;
  const res = await retell<{ phone_number: string }>("POST", "/create-phone-number", { area_code: Number(code), inbound_agent_id: c.agent.agentId, nickname });
  await saveConfig(t, { phone: { ...c.phone, mode: "buy", areaCode: code, number: res.phone_number } });
  await updateTenant(t.id, { phone_number: res.phone_number });
  return { number: res.phone_number, nickname };
}

export async function releaseNumber(tenantId: string): Promise<void> {
  const t = await getTenant(tenantId);
  if (!t) throw new Error("tenant not found");
  const c = configOf(t);
  if (!c.phone.number) return;
  await retell("DELETE", `/delete-phone-number/${encodeURIComponent(c.phone.number)}`);
  await saveConfig(t, { phone: { ...c.phone, number: "" } });
  await updateTenant(t.id, { phone_number: null });
}

export function forwardingInstructions(carrier: string, target: string): string[] {
  const n = target.replace(/\D/g, "").replace(/^1/, "");
  const pretty = n.length === 10 ? `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}` : target;
  const k = carrier.toLowerCase();
  if (k.includes("at&t") || k.includes("att")) return [`Dial *72, wait for the tone, then dial ${pretty}.`, `To send only unanswered calls: dial *92 then ${pretty}.`, `To stop forwarding: dial *73.`];
  if (k.includes("verizon")) return [`Dial *72${n} and press call; hang up after the confirmation.`, `To send only unanswered calls: *71${n}.`, `To stop forwarding: *73.`];
  if (k.includes("t-mobile") || k.includes("tmobile")) return [`Dial **21*${n}# and press call.`, `To send only unanswered calls: **61*${n}#.`, `To stop forwarding: ##21#.`];
  if (k.includes("comcast") || k.includes("xfinity") || k.includes("spectrum") || k.includes("cox")) return [`On your handset dial *72, wait for the tone, then dial ${pretty}.`, `Your provider's online account also has a Call Forwarding setting where you can enter ${pretty}.`, `To stop forwarding: dial *73.`];
  if (k.includes("ringcentral") || k.includes("voip") || k.includes("weave") || k.includes("ooma") || k.includes("nextiva")) return [`In your phone system's admin, add ${pretty} as the forwarding destination for the main number, after-hours and overflow, or always.`, `Most systems call this "call handling" or "answering rules".`];
  return [`Most carriers forward with *72 followed by ${pretty}, and stop with *73.`, `If that does not work, your carrier's support line can switch it on in a minute.`];
}
