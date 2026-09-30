/**
 * Settings: the onboarding screens again, all on one page, editable. Saving
 * a section stores it; "Publish again" pushes the assistant.
 */
import type { Metadata } from "next";
import Notice from "@/app/admin/Notice";
import { requireTenant } from "@/lib/auth";
import { PRODUCT } from "@/lib/product";
import { needsRepublish } from "@/lib/provision";
import { configOf } from "@/lib/tenant-config";
import { AccountForm, BehaviourForm, BusinessForm, ServicesForm } from "../setup/forms";
import { publishAgentAction } from "../setup/actions";

export const metadata: Metadata = { title: `Settings | ${PRODUCT.name}`, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const notice = await searchParams;
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const stale = Boolean(c.agent.agentId) && needsRepublish(ctx.tenant);

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
      </main>
    </div>
  );
}
