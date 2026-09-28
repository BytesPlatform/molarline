/**
 * The home page. Result first, then the recorded calls, then how it works,
 * the handover rules, pricing and a short FAQ. Every button leads to a
 * conversation with us or to the live demo, never to a sign-up form.
 *
 * Shared across the three products; every word comes from lib/product.ts.
 */
import { PRODUCT } from "@/lib/product";
import { RECORDINGS } from "@/lib/recordings";
import HearIt from "./components/HearIt";
import Pricing from "./components/Pricing";

export default function Home() {
  const first = RECORDINGS[0];
  return (
    <main>
      <section className="s-hero">
        <div className="s-wrap">
          <div>
            <p className="s-kicker">AI receptionist for {PRODUCT.industry}</p>
            <h1 className="s-h1">{PRODUCT.headline}</h1>
            <p className="s-lead">{PRODUCT.subhead}</p>
            <div className="s-btn-row">
              <a className="s-btn s-btn-primary" href="#hear-it">
                Hear it
              </a>
              <a className="s-btn" href="/book-a-demo">
                Book a demo
              </a>
            </div>
            <div className="s-hero-proof" aria-label="What it does">
              {PRODUCT.proof.map((p) => (
                <div key={p.n} className="s-proof">
                  <span className="s-proof-n">{p.n}</span>
                  <span className="s-proof-l">{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="s-call" aria-label="Example call">
            <div className="s-call-head">
              <span className="s-call-dot" aria-hidden="true" />
              <div>
                <div className="s-call-title">{PRODUCT.heroCall.when}</div>
                <div className="s-call-sub">{PRODUCT.heroCall.kind}</div>
              </div>
            </div>
            <div className="s-bubbles">
              {first.transcript.slice(0, 5).map((line, i) => (
                <div key={i} className={`s-bubble ${line.who === "agent" ? "s-bubble-agent" : "s-bubble-caller"}`}>
                  {line.text}
                </div>
              ))}
            </div>
            <div className="s-call-foot">
              <span className="s-pill">{PRODUCT.heroCall.result}</span>
              <span className="s-small">{PRODUCT.heroCall.length}</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="s-section s-section-alt" id="hear-it">
        <div className="s-wrap">
          <p className="s-kicker">Hear it</p>
          <h2 className="s-h2">This is what your callers will hear</h2>
          <p className="s-p">{PRODUCT.recordingDescription}</p>
          <HearIt recordings={RECORDINGS} />
          <p className="s-note">
            Want to speak to it yourself? The <a href="/demo">live demo</a> answers in your browser, no signup.
          </p>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <p className="s-kicker">How it works</p>
          <h2 className="s-h2">Answers, books, hands over</h2>
          <div className="s-grid-3">
            {PRODUCT.steps.map((step, i) => (
              <div key={step.title} className="s-card">
                <span className="s-step-n">{i + 1}</span>
                <h3 className="s-h3">{step.title}</h3>
                <p className="s-p">{step.body}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: "1.5rem" }}>
            <a className="s-btn" href="/how-it-works">
              The full walk-through
            </a>
          </p>
        </div>
      </section>

      <section className="s-section s-section-alt">
        <div className="s-wrap">
          <div className="s-grid-2">
            <div>
              <p className="s-kicker">When a person takes over</p>
              <h2 className="s-h2">It knows what it is not allowed to do</h2>
              <p className="s-p">
                The assistant works inside rules you set. When a call crosses one, it transfers to your desk, takes a
                message with a callback promise, or alerts the person on call. It never bluffs.
              </p>
              <a className="s-btn" href="/handover">
                Read the handover rules
              </a>
            </div>
            <div className="s-card">
              {PRODUCT.rules.map((rule) => (
                <p key={rule} className="s-rule">
                  <span className="s-rule-x" aria-hidden="true">
                    ×
                  </span>
                  <span>{rule}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="s-section" id="pricing">
        <div className="s-wrap">
          <p className="s-kicker">Pricing</p>
          <h2 className="s-h2">Priced by the minute it talks, not the seat</h2>
          <Pricing />
        </div>
      </section>

      <section className="s-section s-section-alt">
        <div className="s-wrap">
          <p className="s-kicker">Questions</p>
          <h2 className="s-h2">{PRODUCT.faqTitle}</h2>
          <div className="s-faq">
            {PRODUCT.faq.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="s-cta">
        <div className="s-wrap">
          <h2 className="s-h2">{PRODUCT.cta.title}</h2>
          <p className="s-p">{PRODUCT.cta.body}</p>
          <div className="s-btn-row">
            <a className="s-btn s-btn-primary" href="/book-a-demo">
              Book a demo
            </a>
            <a className="s-btn" href="/demo">
              Try the live demo now
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
