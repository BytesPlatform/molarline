import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";
import DemoForm from "../components/DemoForm";

export const metadata: Metadata = {
  title: `Book a demo | ${PRODUCT.name}`,
  description: `Leave your details and a person from ${PRODUCT.name} calls you within one business day to set up a twenty-minute demo on your own setup.`,
  alternates: { canonical: "/book-a-demo" },
};

export default function BookADemo() {
  return (
    <main className="s-section">
      <div className="s-wrap">
        <div className="s-grid-2">
          <div>
            <p className="s-kicker">Book a demo</p>
            <h1 className="s-h2">{PRODUCT.bookTitle}</h1>
            <p className="s-p">{PRODUCT.bookLead}</p>
            <p className="s-p">
              Prefer to hear it first? The <a href="/#hear-it">recorded call</a> is on the home page.
            </p>
            <p className="s-small">
              We do not run a self-serve trial. Every customer starts with this call, so the assistant is set up right the
              first time.
            </p>
          </div>
          <div className="s-card">
            <DemoForm consentText={PRODUCT.consentText} productName={PRODUCT.name} example={PRODUCT.formExample} />
          </div>
        </div>
      </div>
    </main>
  );
}
