import { emailMode } from "@/lib/messaging/email";
import { jobCounts } from "@/lib/jobs";
import { listLeads } from "@/lib/leads";
import { PRODUCT } from "@/lib/product";
import { runJobsNowAction } from "../actions";
import Notice from "../Notice";

export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const STATUS_TAG: Record<string, string> = { new: "tag-accent", contacted: "tag-warn", booked: "tag-ok", converted: "tag-ok", closed: "" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [leads, jobs] = await Promise.all([listLeads(200), jobCounts()]);
  const cronSet = Boolean(process.env.CRON_SECRET);

  return (
    <>
      <Notice ok={params.ok} error={params.error} />

      {emailMode() === "preview" ? (
        <p className="admin-warn">
          SendGrid is not configured, so emails are recorded as previews and nothing is sent. Set SENDGRID_API_KEY and a
          verified SENDGRID_FROM_EMAIL to send for real. Demo requests still arrive here; only the notification to{" "}
          {PRODUCT.salesInbox} is held.
        </p>
      ) : null}
      {!cronSet ? (
        <p className="admin-warn">
          CRON_SECRET is not set, so the scheduled worker cannot run and follow-up emails stay queued. Set it on Vercel; the
          cron in vercel.json calls the worker every five minutes with it.
        </p>
      ) : null}

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h1 className="admin-title">Demo requests</h1>
            <span className="admin-sub">
              {jobs.queued} follow-ups queued · {jobs.failed} failed · {jobs.done_24h} ran in the last day
              {jobs.next_run_at ? ` · next due ${WHEN.format(new Date(jobs.next_run_at))}` : ""}
            </span>
          </div>
          <div className="admin-actions">
            <form action={runJobsNowAction}>
              <button className="btn btn-quiet" type="submit">
                Run due jobs now
              </button>
            </form>
            <a className="btn btn-quiet" href="/admin/jobs">
              Job log
            </a>
          </div>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Who</th>
              <th>Contact</th>
              <th>Wants</th>
              <th>Status</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>
                  <a className="admin-link" href={`/admin/leads/${l.id}`}>
                    {l.name}
                  </a>
                  <span className="admin-sub">{l.business ?? "(no business given)"}</span>
                </td>
                <td>
                  {l.phone}
                  <span className="admin-sub">{l.email}</span>
                </td>
                <td className="admin-clamp">{l.message ?? <span className="admin-sub">(nothing written)</span>}</td>
                <td>
                  <span className={`tag ${STATUS_TAG[l.status] ?? ""}`}>{l.status}</span>
                  {!l.consent_contact ? <span className="admin-sub">no consent</span> : null}
                </td>
                <td>{WHEN.format(new Date(l.created_at))}</td>
              </tr>
            ))}
            {leads.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-sub">
                  No demo requests yet. The form at /book-a-demo writes here.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
