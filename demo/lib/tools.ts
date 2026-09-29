/**
 * The seven functions the voice agent can call, and nothing else.
 *
 * Two rules hold everywhere in this file:
 *   1. A tool returns the smallest thing the agent needs to speak. Never a
 *      phone number, an address, an email, a balance or a clinical note.
 *   2. Every call writes an audit row and a pipeline step, success or failure.
 *
 * Slot ids are self describing (start|provider|operatory|type) so booking
 * needs no server-side cache between turns. That matters on serverless, where
 * the next request may land on a different instance.
 */

import { q } from "./db";
import { tenant, tenantId } from "./tenancy";
import {
  APPOINTMENT_TYPES,
} from "./config";
import { logAccess, logConsent, logPipeline, queueRequest, touchCall } from "./audit";
import { enqueue } from "./jobs";
import { notifyOwners } from "./notify";
import { recordSmsConsent } from "./sms";
import { appointmentTypeByIdFor, cfg, operatoriesFor, providerByIdFor, resolveOfficeFor } from "./tenant-config";

// The practice's own configuration, read at call time. The demo tenant runs on the defaults in config.ts.
const providerById = (id: string) => providerByIdFor(cfg(), id);
const appointmentTypeById = (id: string) => appointmentTypeByIdFor(cfg(), id);
import { nameMatches, nameTokens, parseDob } from "./identity";
import { patientRef, phoneHash, type ToolRequest } from "./retell";

export type ToolResponse = Record<string, unknown>;

const SPEAK_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const SPEAK_TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function say(start: Date, providerId: string): string {
  const provider = providerById(providerId);
  return `${SPEAK_DATE.format(start)} at ${SPEAK_TIME.format(start)} with ${provider?.name ?? "the next available provider"}`;
}

function encodeSlot(start: Date, providerId: string, operatoryId: string, typeId: string): string {
  return [start.toISOString(), providerId, operatoryId, typeId].join("|");
}

function decodeSlot(id: string) {
  const [iso, providerId, operatoryId, typeId] = id.split("|");
  const start = new Date(iso);
  if (Number.isNaN(start.getTime()) || !providerId || !operatoryId || !typeId) return null;
  return { start, providerId, operatoryId, typeId };
}

function resolveLocation(raw: unknown): string {
  return resolveOfficeFor(cfg(), raw);
}

/** ---------------------------------------------------------------- 1 */

async function findPatient(req: ToolRequest): Promise<ToolResponse> {
  // The date is the exact factor. The name is matched forgivingly, because
  // speech to text splits and spells names however it likes.
  const dob = parseDob(req.args.date_of_birth);
  const tokens = nameTokens(req.args.first_name, req.args.last_name);

  const rows = dob
    ? (
        await q<{ id: string; first_name: string; last_name: string; location_id: string }>(
          `select id, first_name, last_name, location_id from demo_patients
           where tenant_id = $2 and date_of_birth = $1::date`,
          [dob, tenantId()],
        )
      ).filter((p) => nameMatches(tokens, p.first_name, p.last_name))
    : [];

  if (rows.length !== 1) {
    await logPipeline(req.call.call_id, "patient_matched", "warn", rows.length ? "more than one match" : "no match");
    await logAccess({
      actor: "retell-agent",
      action: "find_patient",
      callId: req.call.call_id,
      outcome: "not_found",
      detail: { matches: rows.length },
    });
    return { status: "not_found" };
  }

  const patient = rows[0];
  const ref = patientRef(patient.id);

  await logPipeline(req.call.call_id, "patient_matched", "ok", `1 match, ref ${ref.slice(0, 8)}`);
  await logAccess({
    actor: "retell-agent",
    action: "find_patient",
    callId: req.call.call_id,
    patientRef: ref,
    location: patient.location_id,
    outcome: "ok",
  });

  // Only the id and the first name go back to the model.
  return { status: "found", patient_id: patient.id, first_name: patient.first_name };
}

/** ---------------------------------------------------------------- 2 */

async function getSlots(req: ToolRequest): Promise<ToolResponse> {
  const started = Date.now();
  const locationId = resolveLocation(req.args.location ?? req.call.retell_llm_dynamic_variables?.location);
  const typeId = String(req.args.appointment_type ?? "hygiene");
  const type = appointmentTypeById(typeId) ?? cfg().appointmentTypes[0] ?? APPOINTMENT_TYPES[0];
  const preference = String(req.args.time_preference ?? "any").toLowerCase();
  const providerPref = String(req.args.provider ?? "any").toLowerCase();

  const candidates = cfg().providers.filter(
    (p) =>
      p.locationId === locationId &&
      type.providerIds.includes(p.id) &&
      (providerPref === "any" || p.name.toLowerCase().includes(providerPref)),
  );

  const from = new Date();
  const to = new Date(from.getTime() + 14 * 24 * 60 * 60_000);

  const busy = await q<{ provider_id: string; operatory_id: string; starts_at: string; ends_at: string }>(
    `select provider_id, operatory_id, starts_at, ends_at from demo_appointments
     where tenant_id = $4 and location_id = $1 and status <> 'cancelled'
       and starts_at between $2 and $3`,
    [locationId, from.toISOString(), to.toISOString(), tenantId()],
  );

  const taken = busy.map((b) => ({
    providerId: b.provider_id,
    operatoryId: b.operatory_id,
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
  }));

  const slots: { id: string; say: string }[] = [];

  outer: for (let day = 1; day <= 14 && slots.length < 3; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (let hour = 8; hour < 17; hour++) {
      if (hour === 12) continue;
      if (preference.includes("morning") && hour >= 12) continue;
      if (preference.includes("afternoon") && hour < 12) continue;

      for (const minute of [0, 20, 40]) {
        const start = new Date(date);
        start.setHours(hour, minute, 0, 0);
        if (start.getTime() < Date.now()) continue;
        const end = new Date(start.getTime() + type.minutes * 60_000);
        if (end.getHours() >= 17) continue;

        for (const provider of candidates) {
          const ops = operatoriesFor(cfg()).filter((o) => o.locationId === locationId);
          const op = ops.find(
            (o) =>
              !taken.some(
                (t) =>
                  (t.providerId === provider.id || t.operatoryId === o.id) &&
                  start.getTime() < t.end &&
                  end.getTime() > t.start,
              ),
          );
          if (!op) continue;

          slots.push({ id: encodeSlot(start, provider.id, op.id, type.id), say: say(start, provider.id) });
          taken.push({ providerId: provider.id, operatoryId: op.id, start: start.getTime(), end: end.getTime() });
          if (slots.length >= 3) break outer;
          break;
        }
      }
    }
  }

  await logPipeline(
    req.call.call_id,
    "slots_checked",
    slots.length ? "ok" : "warn",
    `${slots.length} offered, ${type.name}`,
    Date.now() - started,
  );
  await logAccess({
    actor: "retell-agent",
    action: "get_slots",
    callId: req.call.call_id,
    location: locationId,
    outcome: slots.length ? "ok" : "not_found",
    detail: { type: type.id, offered: slots.length },
  });

  return slots.length ? { slots } : { status: "none_available" };
}

/** ---------------------------------------------------------------- 3 */

async function bookAppointment(req: ToolRequest): Promise<ToolResponse> {
  const started = Date.now();
  const slot = decodeSlot(String(req.args.slot_id ?? ""));
  const patientId = String(req.args.patient_id ?? "");

  if (!slot || !patientId) {
    await logPipeline(req.call.call_id, "appointment_written", "error", "bad slot or patient id");
    return fallbackToQueue(req, "pms_error", { slot_id: req.args.slot_id });
  }

  const type = appointmentTypeById(slot.typeId) ?? cfg().appointmentTypes[0] ?? APPOINTMENT_TYPES[0];
  const end = new Date(slot.start.getTime() + type.minutes * 60_000);
  const provider = providerById(slot.providerId);
  const locationId = provider?.locationId ?? cfg().offices[0]?.id ?? "downtown";

  const clash = await q<{ id: string }>(
    `select id from demo_appointments
     where tenant_id = $5 and status <> 'cancelled'
       and (provider_id = $1 or operatory_id = $2)
       and starts_at < $4 and ends_at > $3`,
    [slot.providerId, slot.operatoryId, slot.start.toISOString(), end.toISOString(), tenantId()],
  );

  if (clash.length) {
    await logPipeline(req.call.call_id, "appointment_written", "warn", "slot taken while we were talking");
    return fallbackToQueue(req, "pms_error", { slot_id: req.args.slot_id });
  }

  const id = `apt_${Date.now().toString(36)}`;
  await q(
    `insert into demo_appointments
       (id, patient_id, provider_id, operatory_id, location_id, type_id,
        starts_at, ends_at, status, created_by, call_id, tenant_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'booked','ai_agent',$9,$10)`,
    [
      id,
      patientId,
      slot.providerId,
      slot.operatoryId,
      locationId,
      slot.typeId,
      slot.start.toISOString(),
      end.toISOString(),
      req.call.call_id,
      tenantId(),
    ],
  );

  const ref = patientRef(patientId);
  await logPipeline(req.call.call_id, "appointment_written", "ok", say(slot.start, slot.providerId), Date.now() - started);
  await logAccess({
    actor: "retell-agent",
    action: "book_appointment",
    callId: req.call.call_id,
    patientRef: ref,
    appointmentRef: id,
    location: locationId,
    outcome: "ok",
    detail: { type: slot.typeId },
  });
  await logPipeline(req.call.call_id, "audit_logged", "ok", "1 access row written");

  // The owner hears about it, and the patient gets a reminder the day
  // before (sent only if they opted in; the text carries nothing beyond
  // date, time, provider and office).
  const t = tenant();
  const whenLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: t.timezone }).format(slot.start);
  await notifyOwners(t, {
    template: "owner_booked",
    subject: `Booked: ${type.name}, ${whenLabel}`,
    title: "The assistant booked an appointment",
    lines: [`${type.name} with ${provider?.name ?? "a provider"} is on the schedule for ${whenLabel}.`],
    ctaLabel: "See the schedule",
    ctaPath: "/app/schedule",
  });
  const reminderAt = new Date(slot.start.getTime() - 24 * 3_600_000);
  if (reminderAt.getTime() > Date.now() + 30 * 60_000) {
    await enqueue("visit_reminder", { tenant_id: t.id, appointment_id: id, starts_at: slot.start.toISOString() }, reminderAt, { tenantId: t.id });
  }

  return { status: "booked", say: say(slot.start, slot.providerId), appointment_id: id };
}

/** ---------------------------------------------------------------- 4 */

async function rescheduleAppointment(req: ToolRequest): Promise<ToolResponse> {
  const started = Date.now();
  const patientId = String(req.args.patient_id ?? "");
  const slot = decodeSlot(String(req.args.slot_id ?? ""));
  if (!slot || !patientId) return fallbackToQueue(req, "pms_error", { slot_id: req.args.slot_id });

  const existing = await q<{ id: string }>(
    `select id from demo_appointments
     where tenant_id = $2 and patient_id = $1 and status = 'booked' and starts_at > now()
     order by starts_at asc limit 1`,
    [patientId, tenantId()],
  );

  if (!existing.length) {
    await logPipeline(req.call.call_id, "appointment_written", "warn", "nothing upcoming to move");
    return { status: "no_upcoming_appointment" };
  }

  await q(`update demo_appointments set status = 'cancelled' where id = $1 and tenant_id = $2`, [existing[0].id, tenantId()]);
  const booked = await bookAppointment(req);

  await logAccess({
    actor: "retell-agent",
    action: "reschedule_appointment",
    callId: req.call.call_id,
    patientRef: patientRef(patientId),
    appointmentRef: existing[0].id,
    outcome: "ok",
    detail: { moved_from: existing[0].id, ms: Date.now() - started },
  });

  return booked;
}

/** ---------------------------------------------------------------- 5 */

async function cancelAppointment(req: ToolRequest): Promise<ToolResponse> {
  const patientId = String(req.args.patient_id ?? "");
  const rows = await q<{ id: string; starts_at: string; provider_id: string }>(
    `update demo_appointments set status = 'cancelled'
     where id = (
       select id from demo_appointments
       where tenant_id = $2 and patient_id = $1 and status = 'booked' and starts_at > now()
       order by starts_at asc limit 1
     ) returning id, starts_at, provider_id`,
    [patientId, tenantId()],
  );

  if (!rows.length) return { status: "no_upcoming_appointment" };

  await logPipeline(req.call.call_id, "appointment_written", "ok", "cancelled");
  await logAccess({
    actor: "retell-agent",
    action: "cancel_appointment",
    callId: req.call.call_id,
    patientRef: patientRef(patientId),
    appointmentRef: rows[0].id,
    outcome: "ok",
  });

  return { status: "cancelled", say: say(new Date(rows[0].starts_at), rows[0].provider_id) };
}

/** ---------------------------------------------------------------- 6 */

async function confirmAppointment(req: ToolRequest): Promise<ToolResponse> {
  const patientId = String(req.args.patient_id ?? "");
  const rows = await q<{ id: string; starts_at: string; provider_id: string }>(
    `update demo_appointments set status = 'confirmed'
     where id = (
       select id from demo_appointments
       where tenant_id = $2 and patient_id = $1 and status in ('booked','confirmed') and starts_at > now()
       order by starts_at asc limit 1
     ) returning id, starts_at, provider_id`,
    [patientId, tenantId()],
  );

  if (!rows.length) return { status: "no_upcoming_appointment" };

  await logPipeline(req.call.call_id, "appointment_written", "ok", "confirmed");
  await logAccess({
    actor: "retell-agent",
    action: "confirm_appointment",
    callId: req.call.call_id,
    patientRef: patientRef(patientId),
    appointmentRef: rows[0].id,
    outcome: "ok",
  });

  return { status: "confirmed", say: say(new Date(rows[0].starts_at), rows[0].provider_id) };
}

/** ---------------------------------------------------------------- 7 */

async function recordSmsOptIn(req: ToolRequest): Promise<ToolResponse> {
  const optedIn = req.args.opted_in === true || String(req.args.opted_in).toLowerCase() === "true";
  const phone = String(req.call.from_number ?? req.args.phone ?? "+15550000000");

  // One registry for consent and suppression, shared with the STOP webhook.
  await recordSmsConsent({ phone, kind: optedIn ? "sms_opt_in" : "sms_opt_out", source: "call", callId: req.call.call_id });

  await logPipeline(req.call.call_id, "consent_recorded", "ok", optedIn ? "text reminders on" : "opted out");
  if (optedIn) {
    await logPipeline(req.call.call_id, "reminder_queued", "ok", "confirmation text queued");
  }

  return { status: "recorded" };
}

/** Shared fallback: the front desk picks it up when the write cannot land. */
async function fallbackToQueue(
  req: ToolRequest,
  reason: string,
  requested: Record<string, unknown>,
): Promise<ToolResponse> {
  const locationId = resolveLocation(req.args.location);
  const id = await queueRequest({
    callId: req.call.call_id,
    patientRef: req.args.patient_id ? patientRef(String(req.args.patient_id)) : null,
    location: locationId,
    reason,
    requested,
  });

  await logPipeline(req.call.call_id, "appointment_written", "warn", `queued for the front desk, ref ${id}`);
  await notifyOwners(tenant(), {
    template: "owner_queue",
    subject: `Front desk request: ${reason.replace(/_/g, " ")}`,
    title: "A request is waiting for the front desk",
    lines: [`The assistant could not finish this on the call and queued it: ${reason.replace(/_/g, " ")}.`],
    ctaLabel: "Open the Needs-you list",
    ctaPath: "/app",
  });
  await logAccess({
    actor: "n8n",
    action: "queue_request",
    callId: req.call.call_id,
    location: locationId,
    outcome: "queued",
    detail: { reason },
  });

  return { status: "queued", reason, say: "our team will confirm with you within the hour" };
}

async function queueRequestTool(req: ToolRequest): Promise<ToolResponse> {
  return fallbackToQueue(req, String(req.args.reason ?? "new_patient"), {
    note_code: String(req.args.note_code ?? "callback"),
    preference: req.args.preference ?? null,
  });
}

/**
 * A caller we could not find is, nine times out of ten, a new patient. Set
 * them up on the spot with the two identifiers the practice keys on, name
 * and date of birth, and carry straight on to booking. The office completes
 * the file later; the audit trail records the creation like any other write.
 */
async function createPatient(req: ToolRequest): Promise<ToolResponse> {
  const started = Date.now();
  const firstName = String(req.args.first_name ?? "").trim();
  const lastName = String(req.args.last_name ?? "").trim();
  const dob = parseDob(req.args.date_of_birth);
  const locationRaw = String(req.args.location ?? "downtown").toLowerCase();
  const locationId = locationRaw.includes("north") ? "northside" : "downtown";

  if (!firstName || !dob) {
    await logPipeline(req.call.call_id, "patient_matched", "warn", "new patient needs a name and a date of birth");
    return { status: "need_more_detail", say: "I need your full name and your date of birth to set you up." };
  }

  // A browser call has no caller id. The row still needs a number, and it
  // must not collide with another caller's, so it is unique per record.
  const phone = String(req.call.from_number ?? "").trim() || `+1000${String(Date.now()).slice(-9)}`;
  const id = `pat_${Date.now().toString(36)}`;

  await q(
    `insert into demo_patients (id, first_name, last_name, date_of_birth, phone, location_id, tenant_id)
     values ($1,$2,$3,$4::date,$5,$6,$7)`,
    [id, firstName, lastName || "(not given)", dob, phone, locationId, tenantId()],
  );

  const ref = patientRef(id);
  await logPipeline(req.call.call_id, "patient_matched", "ok", `new patient created, ref ${ref.slice(0, 8)}`, Date.now() - started);
  await logAccess({
    actor: "retell-agent",
    action: "patient_created",
    callId: req.call.call_id,
    patientRef: ref,
    location: locationId,
    outcome: "ok",
    detail: { fields: ["name", "date_of_birth", "location"] },
  });

  return {
    status: "created",
    patient_id: id,
    first_name: firstName,
    say: `You're set up, ${firstName}.`,
  };
}

const HANDLERS: Record<string, (req: ToolRequest) => Promise<ToolResponse>> = {
  find_patient: findPatient,
  create_patient: createPatient,
  get_slots: getSlots,
  book_appointment: bookAppointment,
  reschedule_appointment: rescheduleAppointment,
  cancel_appointment: cancelAppointment,
  confirm_appointment: confirmAppointment,
  record_sms_opt_in: recordSmsOptIn,
  queue_request: queueRequestTool,
};

export function knownTools(): string[] {
  return Object.keys(HANDLERS);
}

export async function runTool(req: ToolRequest): Promise<ToolResponse> {
  await touchCall(req.call.call_id, req.call.from_number ? "phone" : "web");

  const handler = HANDLERS[req.name];
  if (!handler) {
    await logPipeline(req.call.call_id, "tool_unknown", "error", req.name);
    return { status: "unknown_function" };
  }

  try {
    return await handler(req);
  } catch (err) {
    await logPipeline(req.call.call_id, req.name, "error", err instanceof Error ? err.message : "unknown error");
    await logAccess({
      actor: "n8n",
      action: req.name,
      callId: req.call.call_id,
      outcome: "error",
    });
    return { status: "error", say: "I could not reach the schedule just now" };
  }
}
