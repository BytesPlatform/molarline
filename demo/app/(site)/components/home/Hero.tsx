"use client";

/**
 * The landing hero. Dark, cinematic: the product's atmosphere photograph
 * unveils behind a floating call card whose transcript arrives line by
 * line, while the headline rises word by word on the left.
 *
 * Shared across the three products; every word comes from lib/product.ts.
 */

import Image from "next/image";
import { PRODUCT } from "@/lib/product";
import { ArrivingLines, Curtain, Marquee, Parallax, Rise, RiseWords, SmoothScroll, Stagger, StaggerItem } from "../../motion";

export default function Hero({ lines }: { lines: { who: string; text: string }[] }) {
  return (
    <section className="lp-hero lp-dark">
      <SmoothScroll />
      <div className="s-wrap lp-hero-grid">
        <div className="lp-hero-copy">
          <Rise delay={0.05}>
            <p className="lp-kicker">AI receptionist for {PRODUCT.industry}</p>
          </Rise>
          <RiseWords as="h1" className="lp-h1" text={PRODUCT.headline} delay={0.12} />
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
          <Stagger className="lp-stats" gap={0.12}>
            {PRODUCT.proof.map((p) => (
              <StaggerItem key={p.n} className="lp-stat">
                <span className="lp-stat-n">{p.n}</span>
                <span className="lp-stat-l">{p.label}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="lp-hero-visual">
          <Curtain className="lp-hero-frame" delay={0.25}>
            <Image
              src="/landing/hero.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 52vw"
              className="lp-hero-img"
            />
          </Curtain>
          <Parallax amount={26} className="lp-hero-card-holder">
            <aside className="lp-call" aria-label="Example call">
              <div className="lp-call-head">
                <span className="lp-call-dot" aria-hidden="true" />
                <div>
                  <div className="lp-call-title">{PRODUCT.heroCall.when}</div>
                  <div className="lp-call-sub">{PRODUCT.heroCall.kind}</div>
                </div>
                <span className="lp-call-len">{PRODUCT.heroCall.length}</span>
              </div>
              <ArrivingLines
                lines={lines}
                renderLine={(line) => (
                  <div className={`lp-bubble ${line.who === "agent" ? "lp-bubble-agent" : "lp-bubble-caller"}`}>{line.text}</div>
                )}
              />
              <div className="lp-call-foot">
                <span className="lp-pill">{PRODUCT.heroCall.result}</span>
              </div>
            </aside>
          </Parallax>
        </div>
      </div>

      <div className="lp-hero-marquee">
        <Marquee items={PRODUCT.ladder.map((step) => step.title)} />
      </div>
    </section>
  );
}
