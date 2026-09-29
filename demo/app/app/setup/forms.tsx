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
  buyNumberAction,
  forwardNumberAction,
  publishAgentAction,
  releaseNumberAction,
  saveAccountAction,
  saveBehaviourAction,
  saveBusinessAction,
  saveServicesAction,
  saveSoftwareAction,
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

export function SoftwareForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveSoftwareAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field">
        <span>Calendar</span>
        <select name="calendar" defaultValue={c.software.calendar}>
          <option value="builtin">The built-in schedule (works today)</option>
          <option value="google">Google Calendar (our team connects it with you)</option>
          <option value="microsoft">Microsoft 365 (our team connects it with you)</option>
        </select>
      </label>
      <label className="admin-field">
        <span>Practice management software</span>
        <select name="pms" defaultValue={c.software.pms}>
          <option value="none">None, use the built-in schedule</option>
          <option value="dentrix">Dentrix (through NexHealth; our team connects it with you)</option>
          <option value="opendental">Open Dental (through NexHealth)</option>
          <option value="eaglesoft">Eaglesoft (through NexHealth)</option>
          <option value="curve">Curve (on request)</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="admin-field admin-field-wide">
        <span>Anything we should know about your setup</span>
        <textarea name="note" rows={2} defaultValue={c.software.note} placeholder="Dentrix on a server in the Downtown office; Northside connects over VPN..." />
      </label>
      <p className="admin-help admin-field-wide">Everything works on the built-in schedule from day one. Choosing a connection here tells our team to set it up with you; nothing changes until they do.</p>
      <Submit mode={mode} />
    </form>
  );
}

export function PhoneForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  const ready = readiness(c);
  const published = Boolean(c.agent.agentId);
  const stale = published && needsRepublish(tenant);
  return (
    <div className="setup-stack">
      <section className="admin-section">
        <h2 className="admin-title-sm">1. Publish the assistant</h2>
        {ready.ok ? (
          <p className="admin-help">
            {published
              ? stale
                ? "Your configuration changed since the assistant was last published. Publish again so the next call uses it."
                : `Published${c.agent.publishedAt ? ` ${new Date(c.agent.publishedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}. It answers with your greeting, offices, providers, appointment types and insurance list.`
              : "This turns everything you entered into your assistant. It takes a few seconds."}
          </p>
        ) : (
          <p className="admin-warn">Still missing: {ready.missing.join(", ")}. Go back and fill those in first.</p>
        )}
        <form action={publishAgentAction}>
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="step" value="phone" />
          <div className="admin-actions">
            <button className={`btn ${published && !stale ? "btn-quiet" : "btn-cta"}`} type="submit" disabled={!ready.ok}>
              {published ? "Publish again" : "Publish the assistant"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-section">
        <h2 className="admin-title-sm">2. A number for it to answer</h2>
        {c.phone.number ? (
          <>
            <p className="admin-help">
              Your assistant answers on <strong>{c.phone.number}</strong>. Call it from your mobile to hear it.
            </p>
            {mode === "settings" ? (
              <form action={releaseNumberAction}>
                <div className="admin-actions">
                  <button className="btn btn-quiet" type="submit">
                    Release this number
                  </button>
                </div>
              </form>
            ) : null}
          </>
        ) : (
          <>
            <p className="admin-help">We buy a local number in your area code and bind it to your assistant. About $2 a month, included in your plan. You can keep your existing number and forward it to this one; the carrier steps are below.</p>
            <form action={buyNumberAction} className="admin-form admin-form-inline">
              <label className="admin-field">
                <span>Area code</span>
                <input name="area_code" defaultValue={c.phone.areaCode || c.basics.callbackNumber.replace(/\D/g, "").replace(/^1/, "").slice(0, 3)} maxLength={3} placeholder="555" />
              </label>
              <div className="admin-actions">
                <button className="btn btn-cta" type="submit" disabled={!published}>
                  Buy the number
                </button>
              </div>
            </form>
            {!published ? <p className="admin-sub">Publish the assistant first.</p> : null}
          </>
        )}
      </section>

      <section className="admin-section">
        <h2 className="admin-title-sm">3. Keeping your existing number</h2>
        <p className="admin-help">Most practices keep their number and forward it: overflow when the desk is busy, after hours, or always. Tell us the number and the carrier and we show the exact steps.</p>
        <form action={forwardNumberAction} className="admin-form admin-form-inline">
          <label className="admin-field">
            <span>Your current practice number</span>
            <input name="existing_number" defaultValue={c.phone.existingNumber} placeholder="(555) 014-2200" />
          </label>
          <label className="admin-field">
            <span>Carrier or phone system</span>
            <input name="carrier" defaultValue={c.phone.carrier} placeholder="AT&T, Verizon, Comcast, Weave, RingCentral..." />
          </label>
          <div className="admin-actions">
            <button className="btn btn-quiet" type="submit">
              Show the steps
            </button>
          </div>
        </form>
        {c.phone.mode === "forward" && c.phone.number ? (
          <ol className="setup-steps-list">
            {forwardingInstructions(c.phone.carrier, c.phone.number).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : c.phone.mode === "forward" ? (
          <p className="admin-sub">Buy the number above first; the forwarding steps need it.</p>
        ) : null}
        <p className="admin-sub">Confirmation texts to patients come from a separate number and are switched on by our team once carrier registration clears. Consent is already being recorded on every call.</p>
      </section>

      {mode === "setup" ? (
        <div className="admin-actions">
          <a className={`btn ${c.phone.number || c.phone.mode === "forward" ? "btn-cta" : "btn-quiet"}`} href="/app/setup/test">
            Continue to the test call
          </a>
        </div>
      ) : null}
      <p className="admin-sub">{PRODUCT.name} numbers are provided through Retell.</p>
    </div>
  );
}

/** The go-live summary, one row per thing the assistant now knows. */
export function SummaryRows({ tenant, c }: { tenant: Tenant; c: ReturnType<typeof configOf> }) {
  return (
    <>
      <tr>
        <td>Practice</td>
        <td>{tenant.name}, {c.basics.timezone.replace("America/", "").replace(/_/g, " ")}</td>
      </tr>
      <tr>
        <td>Number it gives out</td>
        <td>{c.basics.callbackNumber}</td>
      </tr>
      <tr>
        <td>Offices</td>
        <td>{c.offices.map((l) => l.name).join(", ")}</td>
      </tr>
      <tr>
        <td>Providers</td>
        <td>{c.providers.map((p) => p.name).join(", ")}</td>
      </tr>
      <tr>
        <td>Appointment types</td>
        <td>{c.appointmentTypes.map((t) => t.name).join(", ")}</td>
      </tr>
      <tr>
        <td>Insurance named</td>
        <td>{c.insurance.length ? c.insurance.join(", ") : "none; insurance questions go to the desk"}</td>
      </tr>
      <tr>
        <td>Front desk transfer</td>
        <td>{c.behaviour.transferNumber || "not set; the assistant takes a message instead"}</td>
      </tr>
    </>
  );
}

export const STAFF_NOTES = [
  "Appointments the assistant books show on the schedule marked \"by the assistant\".",
  "Anything clinical or about money is handed to the desk with the call summarised; the assistant never answers it.",
  "Requests it could not book are in the front desk queue; someone should work that queue within the hour.",
  "Every record it touched is in the audit log, which is what an auditor will ask to see.",
  "If it gets something wrong, open the call, find the step, and change the rule in Settings. It follows the new rule on the next call.",
];
