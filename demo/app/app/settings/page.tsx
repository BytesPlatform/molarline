/**
 * Settings: the onboarding screens again, all on one page, editable. Saving
 * a section stores it; "Publish again" pushes the assistant.
 */
import type { Metadata } from "next";
import Notice from "@/app/admin/Notice";
import { requireTenant } from "@/lib/auth";
import { monthUsage } from "@/lib/dash";
import { PRODUCT } from "@/lib/product";
import { needsRepublish } from "@/lib/provision";
import { listMemberships } from "@/lib/tenancy";
import { configOf } from "@/lib/tenant-config";
import { AccountForm, BehaviourForm, BusinessForm, PhoneForm, ServicesForm, SoftwareForm } from "../setup/forms";
import { publishAgentAction } from "../setup/actions";
import { inviteMemberAction } from "./actions";

export const metadata: Metadata = { title: `Settings | ${PRODUCT.name}`, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const notice = await searchParams;
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const stale = Boolean(c.agent.agentId) && needsRepublish(ctx.tenant);
  const members = await listMemberships(ctx.tenant.id);
  const usage = await monthUsage(ctx.tenant);

  return (
    <div className="setup setup-settings">
      <aside className="setup-side">
        <a className="setup-brand" href="/app">
          {PRODUCT.name}
        </a>
        <p className="setup-progress-text">Settings for {ctx.tenant.name}</p>
        <ol className="setup-steps">
          {[
            ["account", "Account"],
            ["business", "Business basics"],
            ["services", "What you do"],
            ["behaviour", "How it behaves"],
            ["software", "Calendar and software"],
            ["phone", "Assistant and number"],
            ["messaging", "Messaging"],
            ["team", "Team"],
            ["billing", "Plan and billing"],
          ].map(([id, title]) => (
            <li key={id} className="is-open">
              <a href={`#${id}`}>
                <span className="setup-step-title">{title}</span>
              </a>
            </li>
          ))}
        </ol>
        <a className="btn btn-quiet" href="/app">
          Back to the dashboard
        </a>
      </aside>
      <main className="setup-main">
        <h1 className="admin-title">Settings</h1>
        <Notice ok={notice.ok} error={notice.error} />
        {stale ? (
          <div className="admin-notice admin-notice-error">
            Your configuration has changed since the assistant was last published. It still answers with the old settings until you publish again.
            <form action={publishAgentAction} style={{ marginTop: "0.6rem" }}>
              <input type="hidden" name="mode" value="settings" />
              <input type="hidden" name="step" value="phone" />
              <button className="btn btn-cta" type="submit">
                Publish again
              </button>
            </form>
          </div>
        ) : null}
        <section className="admin-section" id="account">
          <h2 className="admin-title-sm">Account</h2>
          <AccountForm tenant={ctx.tenant} mode="settings" />
        </section>
        <section className="admin-section" id="business">
          <h2 className="admin-title-sm">Business basics</h2>
          <BusinessForm tenant={ctx.tenant} mode="settings" />
        </section>
        <section className="admin-section" id="services">
          <h2 className="admin-title-sm">What you do</h2>
          <ServicesForm tenant={ctx.tenant} mode="settings" />
        </section>
        <section className="admin-section" id="behaviour">
          <h2 className="admin-title-sm">How it behaves</h2>
          <BehaviourForm tenant={ctx.tenant} mode="settings" />
        </section>
        <section className="admin-section" id="software">
          <h2 className="admin-title-sm">Calendar and software</h2>
          <SoftwareForm tenant={ctx.tenant} mode="settings" />
        </section>
        <section id="phone">
          <h2 className="admin-title-sm" style={{ marginBottom: "0.75rem" }}>Assistant and number</h2>
          <PhoneForm tenant={ctx.tenant} mode="settings" />
        </section>

        <section className="admin-section" id="messaging">
          <h2 className="admin-title-sm">Messaging</h2>
          <p className="admin-sub">
            Email notifications are on. Text messages to your patients (confirmations, reminders) run on a
            registered business number, which we set up for you: carrier registration takes a few days.
          </p>
          <p>
            <a className="btn" href={`mailto:${PRODUCT.salesInbox}?subject=${encodeURIComponent(`Enable SMS for ${ctx.tenant.name}`)}`}>
              Contact us to enable SMS
            </a>
          </p>
        </section>

        <section className="admin-section" id="team">
          <h2 className="admin-title-sm">Team</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Who</th>
                <th>Role</th>
                <th>Invitation</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name ? `${m.name} · ${m.email}` : m.email}</td>
                  <td>{m.role}</td>
                  <td>{m.invite_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form className="admin-form" action={inviteMemberAction}>
            <div className="admin-field">
              <label htmlFor="invite-name">Name</label>
              <input id="invite-name" name="name" placeholder="Sam Alvarez" />
            </div>
            <div className="admin-field">
              <label htmlFor="invite-email">Email</label>
              <input id="invite-email" name="email" type="email" required placeholder="sam@example.com" />
            </div>
            <button className="btn" type="submit">
              Invite
            </button>
          </form>
        </section>

        <section className="admin-section" id="billing">
          <h2 className="admin-title-sm">Plan and billing</h2>
          <p className="admin-sub">
            The {usage.plan} plan, {usage.included.toLocaleString()} minutes included. This month the assistant has
            talked for {usage.minutes.toLocaleString()} minutes. We invoice monthly; nothing to do here.
          </p>
          <p className="admin-sub">
            Looking for the technical view? It moved to <a className="admin-link" href="/app/advanced">Advanced</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
