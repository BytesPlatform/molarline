/**
 * End to end check of the pipeline without Next.js, Retell or a database
 * server. Runs against PGlite, the embedded Postgres, so it works on a clean
 * machine with no accounts.
 *
 *   npx tsx tests/smoke.ts
 *
 * It books an appointment the way a real call would and then prints the audit
 * and pipeline rows that the demo screen renders.
 */

import { rm } from "node:fs/promises";
import { q, resetDemo } from "../lib/db";
import { DEMO_TENANT_ID, addMembership, createTenant, getTenant, membershipsForUser, tenantByAgentId, withTenant } from "../lib/tenancy";
import { runTool } from "../lib/tools";
import { createLead, getLead, setLeadStatus } from "../lib/leads";
import { runDueJobs } from "../lib/jobs";
import type { ToolRequest } from "../lib/retell";

const CALL_ID = "call_smoke_001";

function call(name: string, args: Record<string, unknown>): ToolRequest {
  return { name, call: { call_id: CALL_ID }, args };
}

function heading(text: string) {
  console.log(`\n=== ${text} ===`);
}

async function main() {
  // Start from a clean store so the run is repeatable.
  await rm(process.env.PGLITE_DIR || "./.pgdata", { recursive: true, force: true });

  heading("seed");
  await resetDemo();
  const demo = await getTenant(DEMO_TENANT_ID);
  if (!demo) throw new Error("bootstrap did not create the demo tenant");
  if (!(await tenantByAgentId(undefined))) throw new Error("a call without an agent id must fall back to the demo tenant");
  if (await tenantByAgentId("agent_nobody_owns")) throw new Error("an unknown agent must not resolve to any tenant");
  await withTenant(demo, scenes);
  await isolation();
  await landingSite();
}

/**
 * The Book a demo form end to end, in preview mode: the lead row, the two
 * immediate emails, the three follow-up jobs, the worker running them, and
 * the sequence stopping when sales marks the lead contacted.
 */
async function landingSite() {
  heading("landing site: demo request, emails and follow-ups");
  const made = await createLead({
    name: "Dana Whitlock",
    business: "Acme Comfort Systems",
    email: "Dana@Acme.example",
    phone: "+18475550100",
    message: "Answer after hours and only wake me for real emergencies.",
    consent: true,
    followUpMs: { 1: 0, 2: 0, 3: 60 * 60_000 },
  });
  console.log(`lead ${made.lead.id}, notification ${made.notification}, auto-reply ${made.autoReply}, jobs ${made.jobs.join(",")}`);
  if (made.lead.email !== "dana@acme.example") throw new Error("email must be stored lower case");
  const [emails] = await q<{ n: number; previews: number }>(
    `select count(*)::int as n, count(*) filter (where status = 'preview')::int as previews from messages where lead_id = $1`,
    [made.lead.id],
  );
  if (emails.n !== 2 || emails.previews !== 2) throw new Error(`expected two preview emails, found ${emails.n} (${emails.previews} previews)`);

  const first = await runDueJobs();
  console.log("worker:", first.results.map((r) => `${r.id} ${r.outcome}`).join(" | "));
  if (first.done !== 2) throw new Error(`two follow-ups were due, ${first.done} ran`);
  const [after] = await q<{ n: number }>(`select count(*)::int as n from messages where lead_id = $1 and template like 'lead_followup_%'`, [made.lead.id]);
  if (after.n !== 2) throw new Error("the two due follow-ups must each produce an email");

  await setLeadStatus(made.lead.id, "contacted");
  const lead = await getLead(made.lead.id);
  if (!lead?.sequence_stopped_at) throw new Error("marking contacted must stop the sequence");
  const [left] = await q<{ n: number }>(`select count(*)::int as n from jobs where lead_id = $1 and status = 'queued'`, [made.lead.id]);
  if (left.n !== 0) throw new Error("the remaining follow-up must be cancelled once contacted");
  console.log("demo request flow holds");
  console.log("\nAll checks passed.\n");
}

/**
 * A second practice must never see the demo's patients, and the demo must
 * never see theirs. This is the one property tenancy exists for.
 */
async function isolation() {
  heading("tenant isolation");
  const acme = await createTenant({ name: "Acme Family Dentistry", retellAgentId: "agent_acme_test" });
  if ((await tenantByAgentId("agent_acme_test"))?.id !== acme.id) throw new Error("the agent id must resolve to the tenant that owns it");

  const [before] = await q<{ n: number }>(`select count(*)::int as n from phi_access_log where tenant_id = $1`, [DEMO_TENANT_ID]);

  await withTenant(acme, async () => {
    // Sarah Whitfield is a demo patient. Inside Acme she must be a stranger.
    const who = (await runTool({ name: "find_patient", call: { call_id: "call_acme_001" }, args: { first_name: "Sarah", last_name: "Whitfield", date_of_birth: "1986-04-12" } })) as { status: string };
    console.log("acme sees Sarah as:", who.status);
    if (who.status === "found") throw new Error("a demo patient leaked into another tenant");
    const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from demo_appointments where tenant_id = $1`, [acme.id]);
    if (n !== 0) throw new Error(`Acme should have an empty book, found ${n} appointments`);
  });

  const [after] = await q<{ n: number }>(`select count(*)::int as n from phi_access_log where tenant_id = $1`, [DEMO_TENANT_ID]);
  if (after.n !== before.n) throw new Error("an Acme lookup was logged against the demo tenant");
  const [acmeLog] = await q<{ n: number }>(`select count(*)::int as n from phi_access_log where tenant_id = $1`, [acme.id]);
  if (acmeLog.n < 1) throw new Error("Acme's own lookup must be logged under Acme");

  await addMembership({ tenantId: acme.id, email: "Owner@Acme.com", role: "owner" });
  const mine = await membershipsForUser({ id: "user_clerk_123", email: "owner@acme.com" });
  if (mine.length !== 1 || mine[0].clerk_user_id !== "user_clerk_123" || mine[0].invite_status !== "accepted") {
    throw new Error("first sign-in must claim the membership created for that email");
  }
  if ((await membershipsForUser({ id: "user_clerk_999", email: "nobody@acme.com" })).length !== 0) throw new Error("an uninvited email must not get a workspace");
  console.log("isolation and invitation binding hold");
}

async function scenes() {
  const [{ patients, appointments }] = await q<{ patients: number; appointments: number }>(
    `select (select count(*)::int from demo_patients) as patients,
            (select count(*)::int from demo_appointments) as appointments`,
  );
  console.log(`patients ${patients}, seeded appointments ${appointments}`);
  if (patients === 0 || appointments === 0) throw new Error("seed produced no data");

  heading("find_patient, known patient");
  const found = (await runTool(
    call("find_patient", { first_name: "Sarah", last_name: "Whitfield", date_of_birth: "1986-04-12" }),
  )) as { status: string; patient_id?: string; first_name?: string };
  console.log(found);
  if (found.status !== "found" || !found.patient_id) throw new Error("expected to find the seeded patient");
  if ("phone" in found || "last_name" in found) throw new Error("tool leaked a field it should not return");

  heading("find_patient, wrong date of birth");
  const missing = await runTool(
    call("find_patient", { first_name: "Sarah", last_name: "Whitfield", date_of_birth: "1990-01-01" }),
  );
  console.log(missing);
  if ((missing as { status: string }).status !== "not_found") throw new Error("expected not_found");

  heading("get_slots");
  const slots = (await runTool(
    call("get_slots", { location: "downtown", appointment_type: "hygiene", time_preference: "morning" }),
  )) as { slots?: { id: string; say: string }[]; status?: string };
  console.log(slots.slots?.map((s) => s.say) ?? slots);
  if (!slots.slots?.length) throw new Error("expected at least one open slot");
  if (slots.slots.length > 3) throw new Error("agent should never be offered more than three slots");

  heading("book_appointment");
  const booked = (await runTool(
    call("book_appointment", { patient_id: found.patient_id, slot_id: slots.slots[0].id }),
  )) as { status: string; say?: string; appointment_id?: string };
  console.log(booked);
  if (booked.status !== "booked") throw new Error(`expected booked, got ${booked.status}`);

  heading("double booking the same slot falls back to the queue");
  const clash = (await runTool(
    call("book_appointment", { patient_id: "pat_002", slot_id: slots.slots[0].id }),
  )) as { status: string };
  console.log(clash);
  if (clash.status !== "queued") throw new Error("a taken slot should queue for the front desk");

  heading("record_sms_opt_in");
  console.log(await runTool(call("record_sms_opt_in", { opted_in: true })));

  heading("appointment landed on the schedule");
  const rows = await q<{ id: string; created_by: string; starts_at: string; status: string }>(
    `select id, created_by, starts_at, status from demo_appointments
     where created_by = 'ai_agent' order by created_at desc`,
  );
  console.log(rows);
  if (rows.length !== 1) throw new Error(`expected exactly one AI booking, found ${rows.length}`);

  heading("pipeline steps the demo will light up");
  const pipeline = await q<{ step: string; status: string; detail: string | null }>(
    `select step, status, detail from pipeline_events where call_id = $1 order by id asc`,
    [CALL_ID],
  );
  for (const p of pipeline) console.log(`  ${p.status.padEnd(7)} ${p.step.padEnd(22)} ${p.detail ?? ""}`);

  heading("audit rows");
  const audit = await q<{ actor: string; action: string; outcome: string; patient_ref: string | null }>(
    `select actor, action, outcome, patient_ref from phi_access_log order by id asc`,
  );
  for (const a of audit) {
    console.log(`  ${a.actor.padEnd(14)} ${a.action.padEnd(22)} ${a.outcome.padEnd(10)} ${a.patient_ref ?? "-"}`);
  }

  heading("no raw patient identifier is stored in the audit log");
  const leaked = await q<{ n: number }>(
    `select count(*)::int as n from phi_access_log
     where patient_ref is not null and patient_ref like 'pat\\_%'`,
  );
  console.log(`rows containing a raw patient id: ${leaked[0].n}`);
  if (leaked[0].n > 0) throw new Error("audit log must store a hash, not the patient id");

  heading("consent rows");
  console.log(await q(`select kind, script_ver, phone_last4 from consent_events order by id asc`));

  heading("a caller who is not on file is set up and can book on the same call, and is found next time");
  const miss = (await runTool(call("find_patient", { first_name: "Jessica", last_name: "Moore", date_of_birth: "March 3rd 1990" }))) as { status: string };
  if (miss.status !== "not_found") throw new Error("Jessica is not seeded and must not be found");
  const made = (await runTool(call("create_patient", { first_name: "Jessica", last_name: "Moore", date_of_birth: "March 3rd 1990", location: "Downtown" }))) as { status: string; patient_id: string; first_name: string };
  console.log("created:", made.status, made.first_name);
  if (made.status !== "created") throw new Error(`create_patient must create, got ${made.status}`);
  const again = (await runTool(call("find_patient", { first_name: "Jessica Moore", last_name: "", date_of_birth: "3/3/1990" }))) as { status: string; patient_id: string };
  if (again.status !== "found" || again.patient_id !== made.patient_id) throw new Error("a patient created on one call must be found on the next");
  const slots2 = (await runTool(call("get_slots", { location: "downtown", appointment_type: "hygiene", time_preference: "any", provider: "any" }))) as { slots?: { id: string }[] };
  if (!slots2.slots?.length) throw new Error("a new patient must be offered slots");
  const booked2 = (await runTool(call("book_appointment", { patient_id: made.patient_id, slot_id: slots2.slots[0].id }))) as { status: string };
  if (booked2.status !== "booked") throw new Error(`a new patient must be able to book, got ${booked2.status}`);
  const second = (await runTool(call("create_patient", { first_name: "Owen", last_name: "Marsh", date_of_birth: "1 Feb 1985", location: "northside" }))) as { patient_id: string };
  if (second.patient_id === made.patient_id) throw new Error("two new patients must not share a record");

}

main().catch((err) => {
  console.error("\nSMOKE TEST FAILED\n", err);
  process.exit(1);
});
