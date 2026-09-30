import { notFound } from "next/navigation";
import { getTenant, listMemberships, trialState } from "@/lib/tenancy";
import { ONBOARDING_STEPS, configOf, readiness } from "@/lib/tenant-config";
import {
  clearWorkspaceAction,
  inviteMemberAction,
  openWorkspaceAction,
  provisionTenantAction,
  removeMemberAction,
  resendInviteAction,
  setStatusAction,
  extendTrialAction,
  updateTenantAction,
} from "../../actions";
import Notice from "../../Notice";

export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function TenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const notice = await searchParams;
  const tenant = await getTenant(id);
  if (!tenant) notFound();
  const members = await listMemberships(id);
  const trial = trialState(tenant);
  const c = configOf(tenant);
  const ready = readiness(c);

  return (
    <>
      <Notice ok={notice.ok} error={notice.error} />

      <div className="admin-section-head">
        <div>
          <a className="admin-back" href="/admin">
            All customers
          </a>
          <h1 className="admin-title">{tenant.name}</h1>
          <span className="admin-sub">
            {tenant.id} · created {WHEN.format(new Date(tenant.created_at))}
          </span>
        </div>
        <div className="admin-actions">
          <form action={openWorkspaceAction}>
            <input type="hidden" name="id" value={tenant.id} />
            <button className="btn btn-cta" type="submit">
              Open workspace
            </button>
          </form>
        </div>
      </div>

      <section className="admin-section">
        <h2 className="admin-title-sm">Setup and assistant</h2>
        <p className="admin-help">
          {c.onboarding.completedAt
            ? `Setup complete ${WHEN.format(new Date(c.onboarding.completedAt))}.`
            : c.onboarding.startedAt
              ? `Setup in progress: ${Math.min(c.onboarding.step, ONBOARDING_STEPS.length)} of ${ONBOARDING_STEPS.length} steps, started ${WHEN.format(new Date(c.onboarding.startedAt))}.`
              : "The owner has not opened the setup yet."}{" "}
          {c.agent.agentId
            ? `Assistant ${c.agent.agentId}${c.agent.publishedAt ? `, published ${WHEN.format(new Date(c.agent.publishedAt))}` : ""}.`
            : "No assistant published yet."}{" "}
          {c.phone.number ? `Number ${c.phone.number}.` : "No number yet."}
        </p>
        {!ready.ok ? <p className="admin-sub">Not ready to publish: missing {ready.missing.join(", ")}.</p> : null}
        <div className="admin-actions">
          <form action={provisionTenantAction}>
            <input type="hidden" name="id" value={tenant.id} />
            <button className="btn btn-quiet" type="submit" disabled={!ready.ok}>
              {c.agent.agentId ? "Publish the assistant again" : "Publish the assistant"}
            </button>
          </form>
        </div>
      </section>

      <section className="admin-grid">
        <div className="admin-section">
          <h2 className="admin-title-sm">Trial access</h2>
          <p className="admin-help">
            {trial.limited ? (
              trial.expired ? (
                <span className="tag tag-error">finished</span>
              ) : (
                <span className={`tag ${trial.daysLeft <= 1 ? "tag-warn" : "tag-ok"}`}>
                  {trial.daysLeft === 1 ? "last day" : `${trial.daysLeft} days left`}
                </span>
              )
            ) : (
              <span className="admin-sub">no limit set</span>
            )}
            {trial.endsAt ? <span className="admin-sub">until {WHEN.format(new Date(trial.endsAt))}</span> : null}
          </p>
          <div className="admin-actions">
            {[2, 7, 30].map((d) => (
              <form key={d} action={extendTrialAction}>
                <input type="hidden" name="id" value={tenant.id} />
                <input type="hidden" name="days" value={d} />
                <button className="btn btn-quiet" type="submit">
                  Give {d} days
                </button>
              </form>
            ))}
          </div>
        </div>

        <div className="admin-section">
          <h2 className="admin-title-sm">Status</h2>
          <p className="admin-help">
            <span className={`tag ${tenant.status === "active" ? "tag-ok" : tenant.status === "suspended" ? "tag-error" : "tag-warn"}`}>
              {tenant.status}
            </span>
          </p>
          <div className="admin-actions">
            {(["invited", "active", "suspended"] as const)
              .filter((s) => s !== tenant.status)
              .map((s) => (
                <form key={s} action={setStatusAction}>
                  <input type="hidden" name="id" value={tenant.id} />
                  <input type="hidden" name="status" value={s} />
                  <button className="btn btn-quiet" type="submit">
                    Mark {s}
                  </button>
                </form>
              ))}
          </div>
        </div>

        <div className="admin-section">
          <h2 className="admin-title-sm">People</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Invitation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.email}
                    {m.name ? <span className="admin-sub">{m.name}</span> : null}
                  </td>
                  <td>{m.role}</td>
                  <td>
                    <span className={`tag ${m.invite_status === "accepted" ? "tag-ok" : m.invite_status === "failed" ? "tag-error" : m.invite_status === "sent" ? "tag-accent" : "tag-warn"}`}>
                      {m.invite_status}
                    </span>
                    {m.invite_error ? <span className="admin-sub">{m.invite_error}</span> : null}
                    {m.accepted_at ? <span className="admin-sub">signed in {WHEN.format(new Date(m.accepted_at))}</span> : null}
                  </td>
                  <td className="admin-row-actions">
                    {m.invite_status !== "accepted" ? (
                      <form action={resendInviteAction}>
                        <input type="hidden" name="membership_id" value={m.id} />
                        <button className="btn btn-quiet" type="submit">
                          {m.invite_status === "pending" ? "Send invite" : "Resend"}
                        </button>
                      </form>
                    ) : null}
                    <form action={removeMemberAction}>
                      <input type="hidden" name="membership_id" value={m.id} />
                      <button className="btn btn-quiet" type="submit">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-sub">
                    Nobody yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <form action={inviteMemberAction} className="admin-form admin-form-inline">
            <input type="hidden" name="tenant_id" value={tenant.id} />
            <label className="admin-field">
              <span>Name</span>
              <input name="name" placeholder="Optional" />
            </label>
            <label className="admin-field">
              <span>Email</span>
              <input name="email" type="email" required placeholder="person@business.com" />
            </label>
            <label className="admin-field">
              <span>Role</span>
              <select name="role" defaultValue="staff">
                <option value="owner">Owner</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            <div className="admin-actions">
              <button className="btn btn-cta" type="submit">
                Invite
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-title-sm">Details</h2>
        <form action={updateTenantAction} className="admin-form">
          <input type="hidden" name="id" value={tenant.id} />
          <label className="admin-field">
            <span>Business name</span>
            <input name="name" defaultValue={tenant.name} required />
          </label>
          <label className="admin-field">
            <span>Short name</span>
            <input name="short_name" defaultValue={tenant.short_name} />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Tagline</span>
            <input name="tagline" defaultValue={tenant.tagline ?? ""} />
          </label>
          <label className="admin-field">
            <span>Main office number</span>
            <input name="main_number" defaultValue={tenant.main_number ?? ""} />
          </label>
          <label className="admin-field">
            <span>Time zone</span>
            <input name="timezone" defaultValue={tenant.timezone} />
          </label>
          <label className="admin-field">
            <span>Plan</span>
            <select name="plan" defaultValue={tenant.plan}>
              <option value="demo">Demo</option>
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="practice">Practice</option>
              <option value="growth">Growth</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Included minutes a month</span>
            <input name="included_minutes" type="number" min="0" defaultValue={tenant.included_minutes} />
          </label>
          <label className="admin-field">
            <span>Retell agent id</span>
            <input name="retell_agent_id" defaultValue={tenant.retell_agent_id ?? ""} placeholder="agent_…" />
          </label>
          <label className="admin-field">
            <span>Assistant phone number</span>
            <input name="phone_number" defaultValue={tenant.phone_number ?? ""} placeholder="+1…" />
          </label>
          <div className="admin-actions">
            <button className="btn btn-cta" type="submit">
              Save
            </button>
          </div>
        </form>
      </section>

      <section className="admin-section admin-danger">
        <h2 className="admin-title-sm">Clear workspace</h2>
        <p className="admin-help">
          Deletes every call, booking, message and customer record in this workspace. The demo workspace is
          reseeded with its sample week. Type <code className="admin-code">{tenant.id}</code> to confirm.
        </p>
        <form action={clearWorkspaceAction} className="admin-form admin-form-inline">
          <input type="hidden" name="id" value={tenant.id} />
          <label className="admin-field">
            <span>Workspace id</span>
            <input name="confirm" placeholder={tenant.id} />
          </label>
          <div className="admin-actions">
            <button className="btn btn-quiet" type="submit">
              Clear
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
