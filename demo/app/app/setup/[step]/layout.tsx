/**
 * The onboarding frame: a step list with progress on the left, the current
 * step on the right. Save-and-resume comes free, because every step writes
 * to the tenant and the counter remembers the furthest step reached.
 */
import type { Metadata } from "next";
import { requireTenant } from "@/lib/auth";
import { markStarted } from "@/lib/onboarding";
import { PRODUCT } from "@/lib/product";
import { ONBOARDING_STEPS, configOf } from "@/lib/tenant-config";

export const metadata: Metadata = { title: `Setup | ${PRODUCT.name}`, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SetupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ step: string }> }) {
  const { step } = await params;
  const ctx = await requireTenant();
  if (!ctx.viewingAs) await markStarted(ctx.tenant);
  const c = configOf(ctx.tenant);
  const current = ONBOARDING_STEPS.find((s) => s.id === step)?.id;
  const reached = c.onboarding.step;

  return (
    <div className="setup">
      <aside className="setup-side">
        <a className="setup-brand" href="/app">
          {PRODUCT.name}
        </a>
        <div className="setup-progress" aria-label="Progress">
          <div className="setup-progress-bar" style={{ width: `${Math.round((Math.min(reached, 8) / 8) * 100)}%` }} />
        </div>
        <p className="setup-progress-text">
          {c.onboarding.completedAt ? "Setup complete" : `${Math.min(reached, 8)} of 8 steps done`}
        </p>
        <ol className="setup-steps">
          {ONBOARDING_STEPS.map((s, i) => {
            const done = reached > i;
            const state = current === s.id ? "is-current" : done ? "is-done" : i <= reached ? "is-open" : "is-locked";
            return (
              <li key={s.id} className={state}>
                {i <= reached ? (
                  <a href={`/app/setup/${s.id}`}>
                    <span className="setup-step-n">{done ? "✓" : i + 1}</span>
                    <span>
                      <span className="setup-step-title">{s.title}</span>
                      <span className="setup-step-blurb">{s.blurb}</span>
                    </span>
                  </a>
                ) : (
                  <span className="setup-step-link">
                    <span className="setup-step-n">{i + 1}</span>
                    <span>
                      <span className="setup-step-title">{s.title}</span>
                      <span className="setup-step-blurb">{s.blurb}</span>
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="setup-help">
          Stuck? Reply to any of our emails or write to <a href={`mailto:${PRODUCT.salesInbox}`}>{PRODUCT.salesInbox}</a>.
        </p>
      </aside>
      <main className="setup-main">{children}</main>
    </div>
  );
}
