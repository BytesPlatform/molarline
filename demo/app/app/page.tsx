/**
 * Home: the three numbers for today, the Needs-you list, today's calls,
 * the next visits and the receptionist card. Empty workspaces show
 * example rows until the first real call.
 */
import Shell from "@/app/components/dash/Shell";
import { BOOKED_TAG, UPCOMING_TITLE, homeData, type CallRow, type NeedsYouItem, type StatCard, type UpcomingVisit } from "@/lib/dash";
import { exampleHome } from "@/lib/dash-examples";
import { fmtDayTime, fmtTime } from "./fmt";
import { needsDoneAction } from "./home-actions";
import { accountOf, requireDashboard } from "./shared";

export const dynamic = "force-dynamic";

function Delta({ s }: { s: StatCard }) {
  const d = s.today - s.yesterday;
  if (d === 0) return <span className="stat-delta">level with yesterday</span>;
  return (
    <span className={`stat-delta ${d > 0 ? "is-up" : "is-down"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)} vs yesterday
    </span>
  );
}

function UrgencyTag({ urgency }: { urgency: string | null }) {
  if (!urgency) return null;
  return <span className={`tag urg-${urgency}`}>{urgency}</span>;
}

export default async function AppPage() {
  const ctx = await requireDashboard();
  const data = await homeData(ctx.tenant);
  const example = data.hasAnyCalls ? null : exampleHome(data.timezone);
  const tz = data.timezone;

  const stats: StatCard[] = example?.stats ?? data.stats;
  const needsYou: NeedsYouItem[] = example ? example.needsYou : data.needsYou;
  const calls: CallRow[] = example ? example.todaysCalls : data.todaysCalls;
  const upcoming: UpcomingVisit[] = example ? example.upcoming : data.upcoming;

  return (
    <Shell active="home" account={accountOf(ctx)}>
      {example ? (
        <p className="dash-example-note">
          Nothing has happened yet, so everything below is <span className="tag">Example</span> data. It disappears the
          moment your first real call lands.
        </p>
      ) : null}

      <div className="stat-row">
        {stats.map((s) => (
          <section className="panel stat" key={s.label}>
            <span className="stat-label">{s.label}</span>
            <span className="stat-n num">{s.today}</span>
            <Delta s={s} />
          </section>
        ))}
      </div>

      <div className="dash-cols">
        <div className="dash-col">
          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Needs you</h2>
                <p className="panel-sub">What the assistant could not finish on its own</p>
              </div>
            </header>
            <div className="panel-body">
              {needsYou.length === 0 ? (
                <p className="empty">Nothing waiting. The assistant has handled everything it took.</p>
              ) : (
                needsYou.map((n) => (
                  <article className={`need need-${n.kind}`} key={`${n.kind}${n.id}`}>
                    <div className="need-main">
                      <span className="need-title">
                        {n.title}
                        {example ? <span className="tag need-example">Example</span> : null}
                      </span>
                      <span className="need-detail">{n.detail}</span>
                      <span className="need-when">
                        {fmtTime(n.when, tz)}
                        {n.phone ? ` · ${n.phone}` : ""}
                      </span>
                    </div>
                    {!example && n.callId ? (
                      <a className="admin-link" href={`/app/calls?call=${encodeURIComponent(n.callId)}`}>
                        View
                      </a>
                    ) : null}
                    {!example && n.canDone ? (
                      <form action={needsDoneAction}>
                        <input type="hidden" name="kind" value={n.kind} />
                        <input type="hidden" name="id" value={n.id} />
                        <button className="btn btn-quiet" type="submit">
                          Done
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Today's calls</h2>
                <p className="panel-sub">Every call, what it wanted and how it ended</p>
              </div>
              <div className="panel-head-end">
                <a className="admin-link" href="/app/calls">
                  All calls
                </a>
              </div>
            </header>
            <div className="panel-body">
              {calls.length === 0 ? (
                <p className="empty">No calls yet today.</p>
              ) : (
                calls.map((c) => (
                  <article className="callrow" key={c.call_id}>
                    <span className="callrow-time num">{fmtTime(c.started_at, tz)}</span>
                    <div className="callrow-main">
                      <span className="callrow-summary">{c.summary || "Call in progress or not yet analysed."}</span>
                      <span className="callrow-meta">
                        <UrgencyTag urgency={c.urgency} />
                        {c.after_hours ? <span className="tag">after hours</span> : null}
                        {c.booked ? <span className="tag tag-ok">{BOOKED_TAG}</span> : null}
                        {c.flagged ? <span className="tag tag-warn">flagged</span> : null}
                        {example ? <span className="tag">Example</span> : null}
                      </span>
                    </div>
                    {!example ? (
                      <a className="admin-link" href={`/app/calls?call=${encodeURIComponent(c.call_id)}`}>
                        View
                      </a>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="dash-col">
          <section className="panel agent-card">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">Your AI receptionist</h2>
                <p className="panel-sub">
                  {data.agent.published ? (
                    <>
                      <span className="dot-ok" aria-hidden="true" /> Online and answering
                    </>
                  ) : (
                    "Not published yet"
                  )}
                </p>
              </div>
            </header>
            <div className="panel-body">
              <div className="agent-rows">
                <div className="agent-row">
                  <span>Phone number</span>
                  <b className="num">{data.agent.phoneNumber || "Not set"}</b>
                </div>
                <div className="agent-row">
                  <span>Calls this week</span>
                  <b className="num">{data.agent.weekCalls}</b>
                </div>
                <div className="agent-row">
                  <span>Average call</span>
                  <b className="num">{data.agent.avgSeconds ? `${Math.round(data.agent.avgSeconds)}s` : "–"}</b>
                </div>
              </div>
              <a className="btn btn-cta agent-test" href="/app/setup/test">
                Start test call
              </a>
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h2 className="panel-title">{UPCOMING_TITLE}</h2>
                <p className="panel-sub">The next visits on the schedule</p>
              </div>
              <div className="panel-head-end">
                <a className="admin-link" href="/app/schedule">
                  Schedule
                </a>
              </div>
            </header>
            <div className="panel-body">
              {upcoming.length === 0 ? (
                <p className="empty">Nothing coming up.</p>
              ) : (
                upcoming.map((v) => (
                  <article className={`visit-card urg-line-${v.urgency}`} key={v.id}>
                    <span className="visit-card-when num">{fmtDayTime(v.starts_at, tz)}</span>
                    <span className="visit-card-title">
                      {v.title}
                      {example ? <span className="tag need-example">Example</span> : null}
                    </span>
                    <span className="visit-card-meta">
                      {v.client_name}
                      {v.worker_name ? ` · ${v.worker_name}` : ""}
                      {v.by_agent ? " · booked by the assistant" : ""}
                    </span>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
