import { notFound, redirect } from "next/navigation";
import Notice from "@/app/admin/Notice";
import { requireTenant } from "@/lib/auth";
import { stepById, stepIndex } from "@/lib/onboarding";
import { forwardingInstructions } from "@/lib/provision";
import type { Tenant } from "@/lib/tenancy";
import { ONBOARDING_STEPS, configOf, readiness, type StepId } from "@/lib/tenant-config";
import { AccountForm, BehaviourForm, BusinessForm, PhoneForm, ServicesForm, SoftwareForm, STAFF_NOTES, SummaryRows } from "../forms";
import TestCall from "../TestCall";
import { continueFromTestAction, goLiveAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function StepPage({ params, searchParams }: { params: Promise<{ step: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { step } = await params;
  const notice = await searchParams;
  const def = stepById(step);
  if (!def) notFound();
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const i = stepIndex(def.id as StepId);
  // Steps unlock in order; jumping ahead sends you to the furthest one reached.
  if (i > c.onboarding.step) redirect(`/app/setup/${ONBOARDING_STEPS[Math.min(c.onboarding.step, ONBOARDING_STEPS.length - 1)].id}`);

  return (
    <>
      <p className="setup-kicker">Step {i + 1} of {ONBOARDING_STEPS.length}</p>
      <h1 className="admin-title">{def.title}</h1>
      <p className="admin-help setup-lead">{def.blurb}</p>
      <Notice ok={notice.ok} error={notice.error} />

      {def.id === "account" ? <AccountForm tenant={ctx.tenant} mode="setup" /> : null}
      {def.id === "business" ? <BusinessForm tenant={ctx.tenant} mode="setup" /> : null}
      {def.id === "services" ? <ServicesForm tenant={ctx.tenant} mode="setup" /> : null}
      {def.id === "behaviour" ? <BehaviourForm tenant={ctx.tenant} mode="setup" /> : null}
      {def.id === "software" ? <SoftwareForm tenant={ctx.tenant} mode="setup" /> : null}
      {def.id === "phone" ? <PhoneForm tenant={ctx.tenant} mode="setup" /> : null}

      {def.id === "test" ? (
        c.agent.agentId ? (
          <>
            <TestCall companyName={ctx.tenant.name} saved={c.onboarding.checklist} />
            <form action={continueFromTestAction}>
              <div className="admin-actions" style={{ marginTop: "1rem" }}>
                <button className="btn btn-cta" type="submit">
                  Continue to go live
                </button>
                <a className="btn btn-quiet" href="/app/setup/behaviour">
                  Change something first
                </a>
              </div>
            </form>
          </>
        ) : (
          <p className="admin-warn">
            The assistant has not been published yet. <a className="admin-link" href="/app/setup/phone">Publish it on the phone number step</a>, then come back to test it.
          </p>
        )
      ) : null}

      {def.id === "live" ? <GoLive tenant={ctx.tenant} c={c} /> : null}
    </>
  );
}

function GoLive({ tenant, c }: { tenant: Tenant; c: ReturnType<typeof configOf> }) {
  const ready = readiness(c);
  const ticks = Object.values(c.onboarding.checklist).filter(Boolean).length;
  const number = c.phone.number;
  return (
    <div className="setup-stack">
      <section className="admin-section">
        <h2 className="admin-title-sm">Summary</h2>
        <table className="admin-table">
          <tbody>
            <SummaryRows tenant={tenant} c={c} />
            <tr>
              <td>Assistant</td>
              <td>{c.agent.agentId ? `published${c.agent.publishedAt ? " " + new Date(c.agent.publishedAt).toLocaleDateString("en-US") : ""}` : "not published"}</td>
            </tr>
            <tr>
              <td>Number</td>
              <td>{number || "none yet"}{c.phone.mode === "forward" && c.phone.existingNumber ? `, forwarding from ${c.phone.existingNumber}` : ""}</td>
            </tr>
            <tr>
              <td>Test call</td>
              <td>{ticks ? `${ticks} checks passed` : "not made yet"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="admin-section">
        <h2 className="admin-title-sm">What to tell your staff</h2>
        <ul className="s-list setup-list">
          {STAFF_NOTES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      {c.phone.mode === "forward" && number ? (
        <section className="admin-section">
          <h2 className="admin-title-sm">Forward your number when you are ready</h2>
          <ol className="setup-steps-list">
            {forwardingInstructions(c.phone.carrier, number).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {!ready.ok ? <p className="admin-warn">Still missing: {ready.missing.join(", ")}.</p> : null}
      {!c.agent.agentId ? <p className="admin-warn">Publish the assistant on the phone number step before going live.</p> : null}

      <form action={goLiveAction}>
        <div className="admin-actions">
          <button className="btn btn-cta" type="submit" disabled={!ready.ok || !c.agent.agentId}>
            {c.onboarding.completedAt ? "Go to the dashboard" : "Go live"}
          </button>
        </div>
      </form>
    </div>
  );
}
