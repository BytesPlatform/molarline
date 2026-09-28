import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `Privacy policy | ${PRODUCT.name}`,
  description: `What ${PRODUCT.name} collects from callers, prospects and customers, why, how long it is kept, and how to ask for it to be deleted.`,
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <main className="s-section">
      <div className="s-wrap s-prose">
        <p className="s-kicker">Privacy policy</p>
        <h1 className="s-h2">What we collect, and why</h1>
        <p className="s-small">Last updated September 2026. {PRODUCT.name} is a product of {PRODUCT.company}.</p>

        <h2 className="s-h2">If you visit this site</h2>
        <p>
          We keep ordinary server logs (address, browser, pages) for thirty days to keep the site running. We do not use
          advertising trackers. If you play a recording or try the live demo, nothing about you is stored unless you
          speak to the demo, in which case the call is handled like any call below and deleted within seven days.
        </p>

        <h2 className="s-h2">If you ask for a demo</h2>
        <p>
          We store the name, business, phone number, email and message you give us, the time you gave them, and the consent
          line you agreed to. We use them to call and email you about {PRODUCT.name}. You can stop the emails by replying
          to any of them, and you can ask us to delete your details at any time.
        </p>

        <h2 className="s-h2">If you call a business that uses {PRODUCT.name}</h2>
        <p>
          The business you called is responsible for the call; we process it on their behalf. {PRODUCT.privacyCaller}{" "}
          Recordings are deleted after the period the business chooses, ninety days by default. To have your details
          corrected or removed, contact the business; we act on their instruction.
        </p>

        <h2 className="s-h2">If you are a customer</h2>
        <p>
          We store your account details, your configuration and every call handled for you, for as long as you are a
          customer and thirty days after. We use them to provide the service, to invoice you, and to tell you about the
          service itself. We do not sell data and we do not use your calls to train anything.
          {PRODUCT.baa ? " Where the data is protected health information, our business associate agreement with you governs it." : ""}
        </p>

        <h2 className="s-h2">Who else sees data</h2>
        <p>
          Our providers, each under contract and only for their part: Retell for voice, Twilio for texts once enabled,
          SendGrid for email, Clerk for sign-in, Vercel and Neon for hosting and the database. All are in the United
          States.
        </p>

        <h2 className="s-h2">Contact</h2>
        <p>
          Write to <a href={`mailto:${PRODUCT.salesInbox}`}>{PRODUCT.salesInbox}</a>. A person reads it.
        </p>
      </div>
    </main>
  );
}
