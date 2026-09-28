import { jobCounts, listJobs } from "@/lib/jobs";
import { retryJobAction, runJobsNowAction } from "../actions";
import Notice from "../Notice";

export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [jobs, counts] = await Promise.all([listJobs(100), jobCounts()]);

  return (
    <>
      <Notice ok={params.ok} error={params.error} />
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <a className="admin-back" href="/admin/leads">
              Demo requests
            </a>
            <h1 className="admin-title">Job log</h1>
            <span className="admin-sub">
              {counts.queued} queued · {counts.running} running · {counts.failed} failed · {counts.done_24h} done in the last day ·{" "}
              {process.env.CRON_SECRET ? "worker runs once a day at 14:00 UTC" : "CRON_SECRET not set, worker cannot run"}
            </span>
          </div>
          <form action={runJobsNowAction}>
            <button className="btn btn-quiet" type="submit">
              Run due jobs now
            </button>
          </form>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Due</th>
              <th>Status</th>
              <th>Attempts</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  {j.kind.replace(/_/g, " ")} {j.payload.step ? `step ${String(j.payload.step)}` : ""}
                  {j.lead_id ? (
                    <span className="admin-sub">
                      <a className="admin-link" href={`/admin/leads/${j.lead_id}`}>
                        lead {j.lead_id}
                      </a>
                    </span>
                  ) : null}
                </td>
                <td>{WHEN.format(new Date(j.run_at))}</td>
                <td>
                  <span className={`tag ${j.status === "done" ? "tag-ok" : j.status === "failed" ? "tag-error" : j.status === "queued" ? "tag-accent" : ""}`}>{j.status}</span>
                  {j.last_error ? <span className="admin-sub">{j.last_error}</span> : null}
                </td>
                <td>{j.attempts}</td>
                <td className="admin-row-actions">
                  {j.status === "failed" ? (
                    <form action={retryJobAction}>
                      <input type="hidden" name="id" value={j.id} />
                      <button className="btn btn-quiet" type="submit">
                        Retry
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-sub">
                  Nothing scheduled yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
