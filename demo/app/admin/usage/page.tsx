/**
 * Usage by customer: billable minutes against the plan, this month and
 * the two before, with a CSV that matches an invoice line for line.
 */
import { OVERAGE_PER_MINUTE, usageForMonth } from "@/lib/usage";

export const dynamic = "force-dynamic";

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const monthsBack = Math.min(11, Math.max(0, Number(m) || 0));
  const { label, rows } = await usageForMonth(monthsBack);
  const totalMinutes = rows.reduce((a, r) => a + r.minutes, 0);
  const totalOverage = rows.reduce((a, r) => a + r.overageCost, 0);

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h1 className="admin-title">Usage, {label}</h1>
        <div>
          {[0, 1, 2].map((offset) => (
            <a key={offset} className="admin-link" style={{ marginLeft: "0.9rem" }} href={`/admin/usage?m=${offset}`} aria-current={offset === monthsBack}>
              {offset === 0 ? "This month" : offset === 1 ? "Last month" : "Two months ago"}
            </a>
          ))}
          <a className="admin-link" style={{ marginLeft: "0.9rem" }} href={`/admin/usage/export?m=${monthsBack}`}>
            Download CSV
          </a>
        </div>
      </div>
      <p className="admin-sub">
        A call is rounded up to the next whole minute; the month runs in each customer's timezone. Overage is $
        {OVERAGE_PER_MINUTE.toFixed(2)} a minute.
      </p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Plan</th>
            <th>Calls</th>
            <th>Minutes</th>
            <th>Included</th>
            <th>Overage</th>
            <th>Overage $</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7}>No customers yet.</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <a className="admin-link" href={`/admin/tenants/${encodeURIComponent(r.id)}`}>
                    {r.name}
                  </a>
                </td>
                <td>{r.plan}</td>
                <td>{r.calls}</td>
                <td>{r.minutes.toLocaleString()}</td>
                <td>{r.included.toLocaleString()}</td>
                <td>{r.overageMinutes.toLocaleString()}</td>
                <td>{r.overageCost ? `$${r.overageCost.toFixed(2)}` : "–"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="admin-sub">
        {rows.length} customer{rows.length === 1 ? "" : "s"}, {totalMinutes.toLocaleString()} minutes,{" "}
        {totalOverage ? `$${totalOverage.toFixed(2)} in overage` : "no overage"}.
      </p>
    </section>
  );
}
