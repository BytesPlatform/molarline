import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `Terms | ${PRODUCT.name}`,
  description: `The terms on which ${PRODUCT.company} provides ${PRODUCT.name}: monthly service, what we promise, what you are responsible for, and how either side ends it.`,
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <main className="s-section">
      <div className="s-wrap s-prose">
        <p className="s-kicker">Terms of service</p>
        <h1 className="s-h2">The short version, and the one that counts</h1>
        <p className="s-small">Last updated September 2026. These terms are between you and {PRODUCT.company}.</p>

        <h2 className="s-h2">The service</h2>
        <p>
          {PRODUCT.name} answers calls on your behalf, books work into your schedule and the systems you connect, and
          notifies your people. It is software, and it makes mistakes. You review what it did in the dashboard, and you
          remain responsible for the work you do for your customers.
        </p>

        <h2 className="s-h2">Your account</h2>
        <p>
          Accounts are created by us after a demo call. You are responsible for the people you invite and for keeping
          their sign-in details private. You must have the right to forward the phone number you connect and to have
          calls to it recorded with the disclosure the assistant gives.
        </p>

        <h2 className="s-h2">Paying</h2>
        <p>
          Plans are monthly and invoiced in advance; overage minutes are invoiced in arrears. Invoices are due in fourteen
          days. If an invoice goes unpaid for thirty days we may pause the service after telling you.
        </p>

        <h2 className="s-h2">Ending it</h2>
        <p>
          You may cancel at any time by email; the service ends at the end of the paid month and your number is forwarded
          back the same day you ask. We may end the service with thirty days' notice, or immediately if it is used to
          break the law or harm others.
        </p>

        <h2 className="s-h2">What we do not promise</h2>
        <p>
          We aim for the service to be available at all times and will tell you when it is not, but we do not guarantee
          uninterrupted service. Our liability to you is limited to the fees you paid in the three months before the
          claim. We are not liable for lost business from a call the assistant did not handle as you would have.
        </p>

        <h2 className="s-h2">Changes</h2>
        <p>We may update these terms and will email you thirty days before a change that affects you.</p>

        <p>
          Questions: <a href={`mailto:${PRODUCT.salesInbox}`}>{PRODUCT.salesInbox}</a>.
        </p>
      </div>
    </main>
  );
}
