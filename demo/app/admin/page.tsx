import { authConfigured, platformAdminEmails } from "@/lib/auth";
import { listTenants, trialState, type Tenant } from "@/lib/tenancy";
import { leadCounts } from "@/lib/leads";
import { createTenantAction } from "./actions";
import Notice from "./Notice";

export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** How much of the trial is left, in the words sales needs at a glance. */
function accessCell(t: Tenant) {
  const trial = trialState(t);
  if (!trial.limited) return <span className="admin-sub">no limit</span>;
  if (trial.expired) return <span className="tag tag-error">finished</span>;
  return (
    <>
      <span className={`tag ${trial.daysLeft <= 1 ? "tag-warn" : "tag-ok"}`}>
        {trial.daysLeft === 1 ? "last day" : `${trial.daysLeft} days left`}
      </span>
      <span className="admin-sub">until {DATE.format(new Date(trial.endsAt as string))}</span>
    </>
  );
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [tenants, leads] = await Promise.all([listTenants(), leadCounts()]);

  return (
    <>
      <Notice ok={params.ok} error={params.error} />

      {!authConfigured() ? (
        <p className="admin-warn">
          Clerk is not configured on this deployment. Customers can be created and listed, but invitation emails
          will not go out until the Clerk keys are set. See docs/auth-setup.md.
        </p>
      ) : null}
      {platformAdminEmails().length === 0 ? (
        <p className="admin-warn">PLATFORM_ADMIN_EMAILS is empty, so nobody can reach this console in production.</p>
      ) : null}

      {leads.new_leads > 0 ? (
        <p className="admin-notice admin-notice-ok">
          {leads.new_leads} new demo request{leads.new_leads === 1 ? "" : "s"} waiting.{" "}
          <a className="admin-link" href="/admin/leads">
            Open the list
          </a>
          .
        </p>
      ) : null}

      <section className="admin-section">
        <div className="admin-section-head">
          <h1 className="admin-title">Customers</h1>
          <span className="admin-count">{tenants.length}</span>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Status</th>
              <th>Access</th>
              <th>Agent</th>
              <th>People</th>
              <th>Calls, 30 days</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>
                  <a className="admin-link" href={`/admin/tenants/${t.id}`}>
                    {t.name}
                  </a>
                  <span className="admin-sub">{t.id}</span>
                </td>
                <td>
                  <span className={`tag ${t.status === "active" ? "tag-ok" : t.status === "suspended" ? "tag-error" : "tag-warn"}`}>
                    {t.status}
                  </span>
                </td>
                <td>{accessCell(t)}</td>
                <td>{t.retell_agent_id ? <code className="admin-code">{t.retell_agent_id.slice(0, 14)}…</code> : <span className="admin-sub">none yet</span>}</td>
                <td>{t.members}</td>
                <td>{t.calls_30d}</td>
                <td>{DATE.format(new Date(t.created_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-section">
        <h2 className="admin-title">New customer</h2>
        <p className="admin-help">
          Creates the trial workspace and adds the owner. Tick the box to email the invitation now, or send it from
          the customer's page later. Access closes on its own when the days run out; you can extend it from their
          page at any time.
        </p>
        <form action={createTenantAction} className="admin-form">
          <label className="admin-field">
            <span>Business name</span>
            <input name="name" required placeholder="Riverside Family Dental" />
          </label>
          <label className="admin-field">
            <span>Short name</span>
            <input name="short_name" placeholder="Riverside" />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Tagline, shown under the greeting</span>
            <input name="tagline" placeholder="Two locations, one front desk that never misses a call" />
          </label>
          <label className="admin-field">
            <span>Main office number</span>
            <input name="main_number" placeholder="+15550142200" />
          </label>
          <label className="admin-field">
            <span>Time zone</span>
            <input name="timezone" defaultValue="America/Chicago" />
          </label>
          <label className="admin-field">
            <span>Days of access</span>
            <input name="trial_days" type="number" min="1" max="60" defaultValue="2" required />
          </label>

          <div className="admin-divider" />

          <label className="admin-field">
            <span>Owner name</span>
            <input name="owner_name" placeholder="Dana Whitlock" />
          </label>
          <label className="admin-field">
            <span>Owner email</span>
            <input name="owner_email" type="email" required placeholder="owner@business.com" />
          </label>
          <label className="admin-check">
            <input name="send_invite" type="checkbox" defaultChecked />
            <span>Email the invitation now</span>
          </label>

          <div className="admin-actions">
            <button className="btn btn-cta" type="submit">
              Create customer
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
