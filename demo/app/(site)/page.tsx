/**
 * The home page, five sections: the cinematic hero, the recorded calls,
 * how it works beside the never-cross rules, pricing, and the closing
 * band. The FAQ lives on the pricing page.
 *
 * Shared across the three products; every word comes from lib/product.ts.
 */
import { PRODUCT } from "@/lib/product";
import { RECORDINGS } from "@/lib/recordings";
import HearIt from "./components/HearIt";
import Pricing from "./components/Pricing";
import Hero from "./components/home/Hero";
import { Rise, RiseWords, Stagger, StaggerItem } from "./motion";

export default function Home() {
  const heroLines = RECORDINGS[0].transcript.slice(0, 4).map((l) => ({ who: l.who, text: l.text }));
  return (
    <main className="lp">
      <Hero lines={heroLines} />

      <section className="lp-section lp-light" id="hear-it">
        <div className="s-wrap">
          <Rise>
            <p className="lp-kicker">Hear it</p>
          </Rise>
          <RiseWords as="h2" className="lp-h2" text="This is what your callers will hear" />
          <Rise delay={0.15}>
            <p className="lp-p">{PRODUCT.recordingDescription}</p>
          </Rise>
          <Rise delay={0.2}>
            <HearIt recordings={RECORDINGS} />
          </Rise>
          <Rise delay={0.25}>
            <p className="s-note">
              Want to speak to it yourself? The <a href="/demo">live demo</a> answers in your browser, no signup.
            </p>
          </Rise>
        </div>
      </section>

      <section className="lp-section lp-dark">
        <div className="s-wrap">
          <div className="lp-split">
            <div>
              <Rise>
                <p className="lp-kicker">How it works</p>
              </Rise>
              <RiseWords as="h2" className="lp-h2" text="Answers, books, hands over" />
              <Stagger className="lp-steps" gap={0.14}>
                {PRODUCT.steps.map((step, i) => (
                  <StaggerItem key={step.title} className="lp-step">
                    <span className="lp-step-i">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h3 className="lp-h3">{step.title}</h3>
                      <p className="lp-p">{step.body}</p>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
              <Rise delay={0.1}>
                <a className="s-btn lp-btn-ghost" href="/how-it-works">
                  The full walk-through
                </a>
              </Rise>
            </div>
            <Rise className="lp-rules" delay={0.2} y={40}>
              <p className="lp-rules-title">It knows what it is not allowed to do</p>
              {PRODUCT.rules.map((rule) => (
                <p key={rule} className="lp-rule">
                  <span className="lp-rule-x" aria-hidden="true">
                    ×
                  </span>
                  <span>{rule}</span>
                </p>
              ))}
              <a className="lp-rules-link" href="/handover">
                Read the handover rules
              </a>
            </Rise>
          </div>
        </div>
      </section>

      <section className="lp-section lp-light" id="pricing">
        <div className="s-wrap">
          <Rise>
            <p className="lp-kicker">Pricing</p>
          </Rise>
          <RiseWords as="h2" className="lp-h2" text="Priced by the minute it talks, not the seat" />
          <Rise delay={0.15}>
            <p className="lp-p">{PRODUCT.pricingLead}</p>
          </Rise>
          <Rise delay={0.2}>
            <Pricing />
          </Rise>
        </div>
      </section>

      <section className="lp-cta lp-dark">
        <div className="s-wrap">
          <RiseWords as="h2" className="lp-h2 lp-cta-title" text={PRODUCT.cta.title} />
          <Rise delay={0.2}>
            <p className="lp-lead">{PRODUCT.cta.body}</p>
          </Rise>
          <Rise delay={0.3}>
            <div className="s-btn-row lp-cta-btns">
              <a className="s-btn s-btn-primary" href="/book-a-demo">
                Book a demo
              </a>
              <a className="s-btn lp-btn-ghost" href="/demo">
                Try the live demo now
              </a>
            </div>
          </Rise>
        </div>
      </section>
    </main>
  );
}
