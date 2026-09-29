"use client";

/**
 * The landing hero. The product's atmosphere photograph is the whole
 * stage: full bleed under the floating header, settling out of a slow
 * zoom behind gradient scrims, with the headline rising word by word,
 * a small live-call chip floating over the picture and the pipeline
 * marquee along the bottom edge.
 *
 * Shared across the three products; every word comes from lib/product.ts.
 */

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { PRODUCT } from "@/lib/product";
import { EASE, Marquee, Rise, RiseWords, SmoothScroll } from "../../motion";

export default function Hero() {
  const reduced = useReducedMotion();
  const parts = PRODUCT.headlineParts;
  const leadWords = parts.lead.split(" ").length;
  return (
    <section className="lp-hero lp-dark">
      <SmoothScroll />

      <div className="lp-hero-bg" aria-hidden="true">
        <motion.div
          style={{ position: "absolute", inset: 0 }}
          initial={reduced ? false : { scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ duration: 9, ease: "easeOut" }}
        >
          <Image src="/landing/hero.jpg" alt="" fill priority sizes="100vw" />
        </motion.div>
        <div className="lp-hero-shade" />
      </div>

      <div className="lp-chip-pos">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 1.15 }}
        >
          <aside className="lp-chip" aria-label="Example call">
            <div className="lp-chip-head">
              <span className="lp-call-dot" aria-hidden="true" />
              <div>
                <div className="lp-chip-title">{PRODUCT.heroCall.when}</div>
                <div className="lp-chip-sub">{PRODUCT.heroCall.kind}</div>
              </div>
            </div>
            <div className="lp-chip-foot">
              <span className="lp-pill">{PRODUCT.heroCall.result}</span>
              <span className="lp-chip-len">{PRODUCT.heroCall.length}</span>
            </div>
          </aside>
        </motion.div>
      </div>

      <div className="s-wrap lp-hero-content">
        <Rise delay={0.05}>
          <p className="lp-kicker">AI receptionist for {PRODUCT.industry}</p>
        </Rise>
        <h1 className="lp-h1">
          <RiseWords as="span" text={parts.lead} delay={0.1} />{" "}
          <RiseWords as="span" className="lp-h1-accent" text={parts.accent} delay={0.1 + leadWords * 0.05} />
        </h1>
        <Rise delay={0.5}>
          <p className="lp-lead">{PRODUCT.subhead}</p>
        </Rise>
        <Rise delay={0.62}>
          <div className="s-btn-row">
            <a className="s-btn s-btn-primary" href="/book-a-demo">
              Book a demo
            </a>
            <a className="s-btn lp-btn-ghost" href="#hear-it">
              Hear it
            </a>
          </div>
        </Rise>
        <Rise delay={0.78}>
          <p className="lp-trust">
            {PRODUCT.proof.map((p, i) => (
              <span key={p.n}>
                {i > 0 ? <span className="lp-trust-dot" aria-hidden="true" /> : null}
                <b>{p.n}</b> {p.label}
              </span>
            ))}
          </p>
        </Rise>
      </div>

      <div className="lp-hero-marquee">
        <Marquee items={PRODUCT.ladder.map((step) => step.title)} />
      </div>
    </section>
  );
}
