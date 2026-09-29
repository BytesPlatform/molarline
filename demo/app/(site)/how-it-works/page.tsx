import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `How it works | ${PRODUCT.name}`,
  description: `What ${PRODUCT.name} does on every call, step by step, and what setup takes.`,
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorks() {
  return (
    <main>
      <section className="s-section">
        <div className="s-wrap">
          <p className="s-kicker">How it works</p>
          <h1 className="s-h2">The same {PRODUCT.ladder.length} steps on every call</h1>
          <p className="s-lead">
            This is the ladder you watch fill in on the dashboard during a call. It is the same for an emergency and a
            routine booking; only the branches differ.
          </p>
          <div className="s-grid-3">
            {PRODUCT.ladder.map((step, i) => (
              <div key={step.title} className="s-card">
                <span className="s-step-n">{i + 1}</span>
                <h3 className="s-h3">{step.title}</h3>
                <p className="s-p" style={{ margin: 0 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section s-section-alt">
        <div className="s-wrap s-prose">
          <p className="s-kicker">Setup</p>
          {PRODUCT.setup.map((s) => (
            <div key={s.title}>
              <h2 className="s-h2">{s.title}</h2>
              <p>{s.body}</p>
            </div>
          ))}
          <div className="s-btn-row" style={{ marginTop: "1.5rem" }}>
            <a className="s-btn s-btn-primary" href="/book-a-demo">
              Book a demo
            </a>
            <a className="s-btn" href="/#hear-it">
              Hear a recorded call
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
