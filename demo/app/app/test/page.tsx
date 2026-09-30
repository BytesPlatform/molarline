/**
 * The test call. The prospect phones their own assistant from the browser
 * and watches the checklist tick as it answers and works.
 */
import Shell from "@/app/components/dash/Shell";
import { configOf } from "@/lib/tenant-config";
import { accountOf, requireDashboard } from "../shared";
import TestCall from "./TestCall";

export const dynamic = "force-dynamic";

export default async function TestCallPage() {
  const ctx = await requireDashboard();
  const c = configOf(ctx.tenant);

  return (
    <Shell active="home" account={accountOf(ctx)}>
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2 className="panel-title">Test call</h2>
            <p className="panel-sub">Call your assistant and watch what it does, step by step</p>
          </div>
        </header>
        <div className="panel-body">
          {c.agent.agentId ? (
            <TestCall companyName={ctx.tenant.name} saved={c.onboarding.checklist} />
          ) : (
            <p className="empty">
              The assistant has not been published yet. Finish <a href="/app/setup">the setup</a> and it will publish
              itself, or ask us to publish it for you.
            </p>
          )}
        </div>
      </section>
    </Shell>
  );
}
