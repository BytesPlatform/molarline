import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `Security | ${PRODUCT.name}`,
  description: `How ${PRODUCT.name} protects your calls and your callers' details: signed webhooks, encryption in transit and at rest, isolated workspaces, retention you control${PRODUCT.baa ? ", and a HIPAA business associate agreement" : ""}.`,
  alternates: { canonical: "/security" },
};

export default function Security() {
  return (
    <main className="s-section">
      <div className="s-wrap s-prose">
        <p className="s-kicker">Security</p>
        <h1 className="s-h2">Plain answers to the questions you should ask</h1>

        <h2 className="s-h2">Where your data lives</h2>
        <p>
          Your calls, bookings and caller records are stored in a managed Postgres database in the United States,
          encrypted at rest, and reached only over TLS. Every record is tagged with your workspace and every query is
          scoped to it, so one customer's data cannot appear in another's dashboard.
        </p>

        <h2 className="s-h2">Who can see it</h2>
        <p>
          The people you invite. Accounts are created by invitation only; there is no public sign-up. Our support staff can
          open your workspace to help you, and when they do, your dashboard shows it.
        </p>

        <h2 className="s-h2">The phone line</h2>
        <p>
          Voice runs on Retell, a telephony and speech provider. Every message it sends to us about a call is signed, and we
          refuse any that is not. Recordings and transcripts are kept for the period you choose, ninety days by default,
          then deleted.
        </p>

        {PRODUCT.securityExtra.map((s) => (
          <div key={s.title}>
            <h2 className="s-h2">{s.title}</h2>
            <p>{s.body}</p>
          </div>
        ))}

        {PRODUCT.baa ? (
          <>
            <h2 className="s-h2">HIPAA</h2>
            <p>
              {PRODUCT.name} is built to be a business associate: a signed business associate agreement is part of every
              plan, every access to a patient record is written to an audit log with who, when and why, the assistant
              handles scheduling only and refers anything clinical to your team, and recordings are stored with the same
              controls as the rest of your data.
            </p>
          </>
        ) : null}

        <h2 className="s-h2">Recording disclosure</h2>
        <p>
          The opening line tells the caller the call may be recorded and that they are speaking with an assistant. The
          wording is per state, and you approve it in onboarding.
        </p>

        <h2 className="s-h2">Texts</h2>
        <p>
          Callers are only texted after they agree on the call, and every text carries the STOP instruction. Consent is
          recorded with the words that were said and the time.
        </p>

        <h2 className="s-h2">If you leave</h2>
        <p>
          Your number is forwarded back the same day, and your data is exported to you on request and deleted thirty days
          after the account closes.
        </p>

        <p className="s-small">
          Questions from your IT provider or insurer? Write to <a href={`mailto:${PRODUCT.salesInbox}`}>{PRODUCT.salesInbox}</a>{" "}
          and a person answers.
        </p>
      </div>
    </main>
  );
}
