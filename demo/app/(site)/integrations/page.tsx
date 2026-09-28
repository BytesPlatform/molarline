import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `Integrations | ${PRODUCT.name}`,
  description: `${PRODUCT.name} writes bookings to ${PRODUCT.integration.name} and to its own calendar, texts through Twilio when SMS is on, and runs on Retell for voice.`,
  alternates: { canonical: "/integrations" },
};

export default function Integrations() {
  return (
    <main className="s-section">
      <div className="s-wrap s-prose">
        <p className="s-kicker">Integrations</p>
        <h1 className="s-h2">It writes to the tools you already run</h1>
        <p>
          The assistant has to put the {PRODUCT.booking} somewhere your team will see it. These are the places it can
          write to today, stated plainly.
        </p>
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>What it does</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCT.integrations.map((row) => (
              <tr key={row.system}>
                <td>{row.system}</td>
                <td>{row.what}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2 className="s-h2">Something else?</h2>
        <p>{PRODUCT.integrationsMore}</p>
        <p>
          <a className="s-btn s-btn-primary" href="/book-a-demo">
            Book a demo
          </a>
        </p>
      </div>
    </main>
  );
}
