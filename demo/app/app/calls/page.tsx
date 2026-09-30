/**
 * Calls: the list, and for one call the recording, the transcript, what
 * was booked and, behind a details toggle, the pipeline and the texts.
 */
import Shell from "@/app/components/dash/Shell";
import { BOOKED_TAG, callDetail, listCalls } from "@/lib/dash";
import { configOf } from "@/lib/tenant-config";
import { fmtDate, fmtTime } from "../fmt";
import { accountOf, requireDashboard } from "../shared";

export const dynamic = "force-dynamic";

function Urgency({ urgency }: { urgency: string | null }) {
  if (!urgency) return null;
  return <span className={`tag urg-${urgency}`}>{urgency}</span>;
}

function Transcript({ text }: { text: string }) {
  // Retell writes "Agent: …" / "User: …" lines; show them as labelled turns.
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return (
    <div className="call-transcript">
      {lines.map((line, i) => {
        const m = line.match(/^(Agent|User)\s*:\s*(.*)$/i);
        if (!m) return <p key={i}>{line}</p>;
        return (
          <p key={i} className={m[1].toLowerCase() === "agent" ? "turn-agent" : "turn-caller"}>
            <b>{m[1].toLowerCase() === "agent" ? "Assistant" : "Caller"}</b> {m[2]}
          </p>
        );
      })}
    </div>
  );
}

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ call?: string }> }) {
  const ctx = await requireDashboard();
  const tz = ctx.tenant.timezone || configOf(ctx.tenant).basics.timezone;
  const { call: focusId } = await searchParams;
  const calls = await listCalls(ctx.tenant.id);
  const focus = focusId ? await callDetail(ctx.tenant.id, focusId) : null;

  return (
    <Shell active="calls" account={accountOf(ctx)}>
      {focus ? (
        <section className="panel call-focus">
          <header className="panel-head">
            <div>
              <h2 className="panel-title">
                {fmtDate(focus.started_at, tz)}, {fmtTime(focus.started_at, tz)}
              </h2>
              <p className="panel-sub">
                {focus.channel === "phone" ? focus.from_number || "Phone call" : "Browser call"}
                {focus.after_hours ? " · after hours" : ""}
              </p>
            </div>
            <div className="panel-head-end">
              <a className="admin-link" href="/app/calls">
                Close
              </a>
            </div>
          </header>
          <div className="panel-body">
            <p className="callrow-meta">
              <Urgency urgency={focus.urgency} />
              {focus.outcome ? <span className="tag">{focus.outcome}</span> : null}
              {focus.booked ? (
                <span className="tag tag-ok">{BOOKED_TAG}{focus.ticket_value ? ` · $${Math.round(focus.ticket_value)}` : ""}</span>
              ) : null}
              {focus.flagged ? <span className="tag tag-warn">flagged</span> : null}
            </p>
            {focus.summary ? <p className="call-summary">{focus.summary}</p> : null}
            {focus.recording_url ? (
              <audio className="call-audio" controls preload="none" src={focus.recording_url} />
            ) : (
              <p className="empty">No recording was kept for this call.</p>
            )}
            {focus.transcript ? (
              <details className="call-details" open>
                <summary>Transcript</summary>
                <Transcript text={focus.transcript} />
              </details>
            ) : (
              <p className="empty">The transcript arrives a moment after the call ends.</p>
            )}
            <details className="call-details">
              <summary>Every step the assistant took</summary>
              <div className="call-steps">
                {focus.pipeline.length === 0 ? (
                  <p className="empty">No pipeline events for this call.</p>
                ) : (
                  focus.pipeline.map((s, i) => (
                    <p key={i} className={`call-step step-${s.status}`}>
                      <b>{s.step.replaceAll("_", " ")}</b> {s.detail || s.status}
                    </p>
                  ))
                )}
              </div>
            </details>
            {focus.texts.length ? (
              <details className="call-details">
                <summary>Texts sent</summary>
                <div className="call-steps">
                  {focus.texts.map((t, i) => (
                    <p key={i} className="call-step">
                      <b>
                        {t.to_label || "to"} {t.to_number}
                      </b>{" "}
                      {t.body} <span className="tag">{t.status}</span>
                    </p>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2 className="panel-title">Calls</h2>
            <p className="panel-sub">The last {calls.length} calls, newest first</p>
          </div>
        </header>
        <div className="panel-body">
          {calls.length === 0 ? (
            <p className="empty">
              No calls yet. Make one from <a href="/app/test">the test call page</a> and it appears here with its
              transcript.
            </p>
          ) : (
            calls.map((c) => (
              <article className={`callrow${c.call_id === focusId ? " is-focus" : ""}`} key={c.call_id}>
                <span className="callrow-time num">
                  {fmtDate(c.started_at, tz)} {fmtTime(c.started_at, tz)}
                </span>
                <div className="callrow-main">
                  <span className="callrow-summary">{c.summary || "Call in progress or not yet analysed."}</span>
                  <span className="callrow-meta">
                    <Urgency urgency={c.urgency} />
                    {c.after_hours ? <span className="tag">after hours</span> : null}
                    {c.booked ? <span className="tag tag-ok">{BOOKED_TAG}</span> : null}
                    {c.flagged ? <span className="tag tag-warn">flagged</span> : null}
                    {c.has_recording ? <span className="tag">recording</span> : null}
                  </span>
                </div>
                <a className="admin-link" href={`/app/calls?call=${encodeURIComponent(c.call_id)}`}>
                  View
                </a>
              </article>
            ))
          )}
        </div>
      </section>
    </Shell>
  );
}
