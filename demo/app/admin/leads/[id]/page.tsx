import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { getLead } from "@/lib/leads";
import type { Job } from "@/lib/jobs";
import { convertLeadAction, saveLeadNotesAction, setLeadStatusAction } from "../../actions";
import Notice from "../../Notice";

export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

interface MessageRow {
  id: number;
  created_at: string;
  to_address: string;
  template: string;
  subject: string | null;
  status: string;
  provider: string;
  error: string | null;
  body_text: string | null;
}

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const notice = await searchParams;
  const lead = await getLead(Number(id));
  if (!lead) notFound();

  const [messages, jobs] = await Promise.all([
    q<MessageRow>(
      `select id, created_at, to_address, template, subject, status, provider, error, body_text
       from messages where lead_id = $1 order by id asc`,
      [lead.id],
    ),
    q<Job>(`select id, created_at, run_at, kind, payload, status, attempts, last_error, finished_at, lead_id, tenant_id from jobs where lead_id = $1 order by run_at asc`, [lead.id]),
  ]);

  const statuses = ["new", "contacted", "booked", "closed"] as const;

  return (
    <>
      <Notice ok={notice.ok} error={notice.error} />

      <div className="admin-section-head">
        <div>
          <a className="admin-back" href="/admin/leads">
            All demo requests
          </a>
          <h1 className="admin-title">{lead.name}</h1>
          <span className="admin-sub">
            {lead.business ?? "(no business given)"} · received {WHEN.format(new Date(lead.created_at))} · {lead.source.replace(/_/g, " ")}
          </span>
        </div>
        <div className="admin-actions">
          <a className="btn btn-cta" href={`tel:${lead.phone}`}>
            Call {lead.phone}
          </a>
        </div>
      </div>

      <section className="admin-grid">
        <div className="admin-section">
          <h2 className="admin-title-sm">Details</h2>
          <p className="admin-help">
            <strong>Phone</strong> {lead.phone}
            <br />
            <strong>Email</strong> <a className="admin-link" href={`mailto:${lead.email}`}>{lead.email}</a>
            <br />
            <strong>Consent</strong>{" "}
            {lead.consent_contact ? `given ${lead.consent_at ? WHEN.format(new Date(lead.consent_at)) : ""}` : "not given, do not text"}
          </p>
          <p className="admin-help">
            <strong>What they want it to do</strong>
            <br />
            {lead.message ?? "(nothing written)"}
          </p>

          <h2 className="admin-title-sm">Status</h2>
          <p className="admin-help">
            <span className={`tag ${lead.status === "new" ? "tag-accent" : lead.status === "closed" ? "" : "tag-ok"}`}>{lead.status}</span>
            {lead.sequence_stopped_at ? <span className="admin-sub">follow-ups stopped {WHEN.format(new Date(lead.sequence_stopped_at))}</span> : <span className="admin-sub">follow-up emails are running</span>}
          </p>
          <div className="admin-actions">
            {statuses
              .filter((s) => s !== lead.status && lead.status !== "converted")
              .map((s) => (
                <form key={s} action={setLeadStatusAction}>
                  <input type="hidden" name="id" value={lead.id} />
                  <input type="hidden" name="status" value={s} />
                  <button className="btn btn-quiet" type="submit">
                    Mark {s}
                  </button>
                </form>
              ))}
          </div>

          <form action={saveLeadNotesAction} className="admin-form">
            <input type="hidden" name="id" value={lead.id} />
            <label className="admin-field admin-field-wide">
              <span>Notes from the call</span>
              <textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} />
            </label>
            <div className="admin-actions">
              <button className="btn btn-quiet" type="submit">
                Save notes
              </button>
            </div>
          </form>
        </div>

        <div className="admin-section">
          <h2 className="admin-title-sm">Make them a customer</h2>
          {lead.tenant_id ? (
            <p className="admin-help">
              Converted. Workspace:{" "}
              <a className="admin-link" href={`/admin/tenants/${lead.tenant_id}`}>
                {lead.tenant_id}
              </a>
              . Send the invitation from there.
            </p>
          ) : (
            <>
              <p className="admin-help">
                Creates the workspace with {lead.email} as its owner and links this request to it. The invitation is sent
                from the workspace page, once you have checked the details.
              </p>
              <form action={convertLeadAction} className="admin-form">
                <input type="hidden" name="id" value={lead.id} />
                <label className="admin-field">
                  <span>Business name</span>
                  <input name="name" defaultValue={lead.business ?? ""} placeholder={lead.name} />
                </label>
                <label className="admin-field">
                  <span>Short name</span>
                  <input name="short_name" placeholder="First word of the name" />
                </label>
                <label className="admin-field">
                  <span>Plan</span>
                  <select name="plan" defaultValue="practice">
                    <option value="starter">Starter</option>
                    <option value="practice">Practice</option>
                    <option value="group">Group</option>
                  </select>
                </label>
                <label className="admin-field">
                  <span>Included minutes</span>
                  <input name="included_minutes" type="number" min="0" defaultValue="1000" />
                </label>
                <div className="admin-actions">
                  <button className="btn btn-cta" type="submit">
                    Create customer
                  </button>
                </div>
              </form>
            </>
          )}

          <h2 className="admin-title-sm">Emails</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Subject</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>{WHEN.format(new Date(m.created_at))}</td>
                  <td>{m.to_address}</td>
                  <td>
                    {m.subject}
                    <span className="admin-sub">{m.template.replace(/_/g, " ")}</span>
                  </td>
                  <td>
                    <span className={`tag ${["delivered", "opened", "clicked", "sent"].includes(m.status) ? "tag-ok" : ["bounced", "spam", "failed"].includes(m.status) ? "tag-error" : "tag-warn"}`}>
                      {m.status}
                    </span>
                    {m.error ? <span className="admin-sub">{m.error}</span> : null}
                    {m.provider === "preview" ? <span className="admin-sub">not sent, SendGrid not configured</span> : null}
                  </td>
                </tr>
              ))}
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-sub">
                    No emails yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <h2 className="admin-title-sm">Scheduled follow-ups</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{String(j.payload.step ?? "")}</td>
                  <td>{WHEN.format(new Date(j.run_at))}</td>
                  <td>
                    <span className={`tag ${j.status === "done" ? "tag-ok" : j.status === "failed" ? "tag-error" : j.status === "queued" ? "tag-accent" : ""}`}>{j.status}</span>
                    {j.last_error ? <span className="admin-sub">{j.last_error}</span> : null}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="admin-sub">
                    None.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
