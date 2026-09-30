/**
 * The step forms for a dental practice. Server components; each renders one
 * step's fields from the tenant's configuration and posts to its action.
 * Used by the setup flow (mode "setup") and by Settings (mode "settings").
 */
import { PRODUCT } from "@/lib/product";
import { forwardingInstructions, needsRepublish } from "@/lib/provision";
import type { Tenant } from "@/lib/tenancy";
import { configOf, officeByIdFor, providerByIdFor, readiness } from "@/lib/tenant-config";
import {
  saveAccountAction,
  saveBehaviourAction,
  saveBusinessAction,
  saveServicesAction,
} from "./actions";

export type Mode = "setup" | "settings";

function Submit({ mode, label }: { mode: Mode; label?: string }) {
  return (
    <div className="admin-actions">
      <button className="btn btn-cta" type="submit">
        {label ?? (mode === "setup" ? "Save and continue" : "Save")}
      </button>
    </div>
  );
}

export function AccountForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveAccountAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field">
        <span>Practice name, as the assistant will say it</span>
        <input name="name" defaultValue={tenant.name} required />
      </label>
      <label className="admin-field">
        <span>Short name, for texts</span>
        <input name="short_name" defaultValue={tenant.short_name} />
      </label>
      <label className="admin-field">
        <span>Time zone</span>
        <select name="timezone" defaultValue={c.basics.timezone}>
          {["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"].map((z) => (
            <option key={z} value={z}>
              {z.replace("America/", "").replace("Pacific/", "").replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Website</span>
        <input name="website" defaultValue={c.basics.website} placeholder="https://" />
      </label>
      {mode === "setup" ? (
        <>
          <div className="admin-divider" />
          <p className="admin-help" style={{ gridColumn: "1 / -1" }}>
            Invite someone else who should see the schedule, for example your office manager. Optional; you can add people later under Settings.
          </p>
          <label className="admin-field">
            <span>Their name</span>
            <input name="invite_name" />
          </label>
          <label className="admin-field">
            <span>Their email</span>
            <input name="invite_email" type="email" />
          </label>
        </>
      ) : null}
      <Submit mode={mode} />
    </form>
  );
}

export function BusinessForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveBusinessAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field">
        <span>The phone number the assistant gives out for callbacks</span>
        <input name="callback_number" defaultValue={c.basics.callbackNumber} required placeholder="(555) 014-2200" />
      </label>
      <label className="admin-field">
        <span>Outside office hours the assistant should</span>
        <select name="after_hours" defaultValue={c.basics.afterHoursPolicy}>
          <option value="book">Answer and book into the next open day</option>
          <option value="message">Answer and take a message for the front desk</option>
        </select>
      </label>
      <label className="admin-field admin-field-wide">
        <span>
          Offices, one per line: <code className="admin-code">name | address | phone | hours in words | parking</code>. The assistant reads the hours and parking to callers exactly as written.
        </span>
        <textarea name="offices" rows={4} defaultValue={c.offices.map((l) => `${l.name} | ${l.address} | ${l.phone} | ${l.hours} | ${l.parking}`).join("\n")} />
      </label>
      <p className="admin-help admin-field-wide">Two chairs are assumed per office for the schedule; tell us on the demo call if you have more.</p>
      <Submit mode={mode} />
    </form>
  );
}

export function ServicesForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveServicesAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field admin-field-wide">
        <span>
          Providers, one per line: <code className="admin-code">name | role | office</code>. Office is one of: {c.offices.map((l) => l.name).join(", ")}.
        </span>
        <textarea name="providers" rows={5} defaultValue={c.providers.map((p) => `${p.name} | ${p.title} | ${officeByIdFor(c, p.locationId)?.name ?? p.locationId}`).join("\n")} />
      </label>
      <label className="admin-field admin-field-wide">
        <span>
          Appointment types, one per line: <code className="admin-code">name | minutes | providers who do it</code>. Providers by name, comma separated, or "any". Anything a caller asks for that is not on this list goes to the front desk queue.
        </span>
        <textarea name="appointment_types" rows={5} defaultValue={c.appointmentTypes.map((t) => `${t.name} | ${t.minutes} | ${t.providerIds.map((id) => providerByIdFor(c, id)?.name ?? id).join(", ")}`).join("\n")} />
      </label>
      <label className="admin-field admin-field-wide">
        <span>Insurance carriers accepted, comma separated. The assistant names these and always adds that coverage is verified before the visit; it never says what a plan covers.</span>
        <textarea name="insurance" rows={2} defaultValue={c.insurance.join(", ")} />
      </label>
      <label className="admin-field admin-field-wide">
        <span>New patient policy, one or two sentences the assistant says to a new caller</span>
        <textarea name="new_patient_policy" rows={2} defaultValue={c.newPatientPolicy} />
      </label>
      <p className="admin-help admin-field-wide">Fixed rules: the assistant never gives clinical advice, never discusses balances or claims, and never reads anything from a patient record beyond the appointment it is booking.</p>
      <Submit mode={mode} />
    </form>
  );
}

export function BehaviourForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveBehaviourAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field admin-field-wide">
        <span>Greeting. It must say the call is recorded and that the caller is speaking with an assistant; the wording below is fine in every state.</span>
        <textarea name="greeting" rows={3} defaultValue={c.behaviour.greeting} required />
      </label>
      <label className="admin-field">
        <span>Tone</span>
        <select name="tone" defaultValue={c.behaviour.tone}>
          <option value="friendly">Warm and friendly</option>
          <option value="calm">Calm and professional</option>
        </select>
      </label>
      <label className="admin-field">
        <span>Front desk number for "speak to a person"</span>
        <input name="transfer_number" defaultValue={c.behaviour.transferNumber} placeholder="The desk line staff answer" />
      </label>
      <label className="admin-field admin-field-wide">
        <span>What it says when it cannot help</span>
        <input name="cannot_help" defaultValue={c.behaviour.cannotHelp} />
      </label>
      <label className="admin-check admin-field-wide">
        <input type="checkbox" name="take_message" defaultChecked={c.behaviour.takeMessageWhenUnanswered} />
        <span>If the transfer is not answered, take a message for the front desk queue instead of dropping the caller into voicemail</span>
      </label>
      <Submit mode={mode} />
    </form>
  );
}





/** The go-live summary, one row per thing the assistant now knows. */



