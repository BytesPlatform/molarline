/**
 * Advanced: the technical view. The pipeline ladder, the raw call events,
 * the texts log, the assistant's version and webhook health. Everything
 * the old console showed lives here, unchanged in spirit.
 */
import Shell from "@/app/components/dash/Shell";
import { q } from "@/lib/db";
import { needsRepublish } from "@/lib/provision";
import { configOf } from "@/lib/tenant-config";
import { fmtDate, fmtTime } from "../fmt";
import { accountOf, requireDashboard } from "../shared";

export const dynamic = "force-dynamic";

export default async function AdvancedPage() {
  const ctx = await requireDashboard();
  const c = configOf(ctx.tenant);
  const tz = ctx.tenant.timezone || c.basics.timezone;

  const pipeline = await q<{ occurred_at: string; call_id: string; step: string; status: string; detail: string | null }>(
    `select occurred_at, call_id, step, status, detail from pipeline_events
      where tenant_id = $1 order by id desc limit 60`,
    [ctx.tenant.id],
  );
  const events = await q<{ occurred_at: string; call_id: string | null; action: string; outcome: string | null; actor: string | null }>(
    `select occurred_at, call_id, action, outcome, actor from phi_access_log
      where tenant_id = $1 order by id desc limit 40`,
    [ctx.tenant.id],
  );
  const consents = await q<{ occurred_at: string; call_id: string | null; kind: string; phone_last4: string | null }>(
    `select occurred_at, call_id, kind, phone_last4 from consent_events
      where tenant_id = $1 order by id desc limit 30`,
    [ctx.tenant.id],
  );
  const texts = await q<{ created_at: string; to_address: string; template: string; status: string; provider: string }>(
    `select created_at, to_address, template, status, provider from messages
      where tenant_id = $1 order by id desc limit 30`,
    [ctx.tenant.id],
  );
  const [health] = await q<{ last: string | null; day: number }>(
    `select max(occurred_at) as last, count(*) filter (where occurred_at > now() - interval '24 hours')::int as day
       from phi_access_log where tenant_id = $1`,
    [ctx.tenant.id],
  );

  const stamp = (iso: string) => `${fmtDate(iso, tz)} ${fmtTime(iso, tz)}`;

  return (
    <Shell active="settings" account={accountOf(ctx)}>
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2 className="panel-title">Advanced</h2>
            <p className="panel-sub">
              The technical view. Day to day you should never need this page; it is here for when support asks.
            </p>
          </div>
          <div className="panel-head-end">
            <a className="admin-link" href="/app/settings">
              Back to settings
            </a>
          </div>
        </header>
      </section>

      <div className="dash-cols">
        <div className="dash-col">
          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Assistant version</h2>
              </div>
            </header>
            <div className="panel-body">
              <div className="agent-rows">
                <div className="agent-row">
                  <span>Agent</span>
                  <b className="num">{ctx.tenant.retell_agent_id || "not created"}</b>
                </div>
                <div className="agent-row">
                  <span>Published version</span>
                  <b className="num">{c.agent.version ?? "–"}</b>
                </div>
                <div className="agent-row">
                  <span>Published at</span>
                  <b className="num">{c.agent.publishedAt ? stamp(c.agent.publishedAt) : "–"}</b>
                </div>
                <div className="agent-row">
                  <span>Rendered hash</span>
                  <b className="num">{c.agent.renderedHash ?? "–"}</b>
                </div>
                <div className="agent-row">
                  <span>Settings since publish</span>
                  <b>{needsRepublish(ctx.tenant) ? "changed, publish again from Settings" : "up to date"}</b>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Webhook health</h2>
                <p className="panel-sub">Events arriving from the phone line</p>
              </div>
            </header>
            <div className="panel-body">
              <div className="agent-rows">
                <div className="agent-row">
                  <span>Last event</span>
                  <b className="num">{health?.last ? stamp(health.last) : "none yet"}</b>
                </div>
                <div className="agent-row">
                  <span>Events in 24 hours</span>
                  <b className="num">{health?.day ?? 0}</b>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Messages log</h2>
              </div>
            </header>
            <div className="panel-body">
              {texts.length === 0 ? (
                <p className="empty">No messages sent yet.</p>
              ) : (
                texts.map((t, i) => (
                  <p className="call-step" key={i}>
                    <b>{t.to_address}</b> {t.template} <span className="tag">{t.status}</span>{" "}
                    <span className="tag">{t.provider}</span>
                    <span className="need-when"> {stamp(t.created_at)}</span>
                  </p>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Consent log</h2>
                <p className="panel-sub">Every disclosure the assistant read out</p>
              </div>
            </header>
            <div className="panel-body">
              {consents.length === 0 ? (
                <p className="empty">No consent events yet.</p>
              ) : (
                consents.map((e, i) => (
                  <p className="call-step" key={i}>
                    <b>{e.kind.replaceAll("_", " ")}</b> {e.phone_last4 ? `phone ending ${e.phone_last4}` : ""}
                    <span className="need-when"> {stamp(e.occurred_at)}</span>
                  </p>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="dash-col">
          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Pipeline ladder</h2>
                <p className="panel-sub">Every step of the last calls</p>
              </div>
            </header>
            <div className="panel-body">
              {pipeline.length === 0 ? (
                <p className="empty">No pipeline events yet.</p>
              ) : (
                pipeline.map((s, i) => (
                  <p className={`call-step step-${s.status}`} key={i}>
                    <b>{s.step.replaceAll("_", " ")}</b> {s.detail || s.status}
                    <span className="need-when">
                      {" "}
                      {stamp(s.occurred_at)} · {s.call_id.slice(0, 14)}
                    </span>
                  </p>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Audit log</h2>
              </div>
            </header>
            <div className="panel-body">
              {events.length === 0 ? (
                <p className="empty">No events yet.</p>
              ) : (
                events.map((e, i) => (
                  <p className="call-step" key={i}>
                    <b>{e.action}</b> {e.actor || ""} {e.outcome || ""}
                    <span className="need-when">
                      {" "}
                      {stamp(e.occurred_at)}
                      {e.call_id ? ` · ${e.call_id.slice(0, 14)}` : ""}
                    </span>
                  </p>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
