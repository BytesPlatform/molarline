"use client";

/**
 * Motion primitives for the marketing site. One vocabulary, used by every
 * landing section: masked word-rise headlines, soft rises, a curtain reveal
 * for imagery, scroll parallax and a marquee. Everything collapses to a
 * static render when the visitor prefers reduced motion.
 *
 * Shared across the three products verbatim.
 */

import Lenis from "lenis";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export const EASE = [0.19, 1, 0.22, 1] as const;

/** Smooth scrolling for the whole page. Renders nothing. */
export function SmoothScroll() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.12 });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [reduced]);
  return null;
}

/** Fade and rise into place the first time it scrolls into view. */
export function Rise({
  children,
  delay = 0,
  y = 26,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** A headline whose words rise out of an overflow mask, one after another. */
export function RiseWords({
  text,
  as = "h2",
  className,
  delay = 0,
}: {
  text: string;
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return createElement(as, { className }, text);
  const words = text.split(" ");
  // One viewport trigger on the whole headline; the words stagger from it.
  // Spaces live between the masks, not inside them, so they never collapse.
  return createElement(
    as,
    { className, "aria-label": text },
    <motion.span
      aria-hidden="true"
      initial="off"
      whileInView="on"
      viewport={{ once: true, margin: "-8% 0px" }}
      variants={{ off: {}, on: { transition: { delayChildren: delay, staggerChildren: 0.05 } } }}
    >
      {words.map((word, i) => (
        <span key={i}>
          <span className="lp-mask">
            <motion.span
              className="lp-word"
              variants={{
                off: { y: "115%", rotate: 4 },
                on: { y: "0%", rotate: 0, transition: { duration: 0.85, ease: EASE } },
              }}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </motion.span>,
  );
}

/** Children rise in order. Wrap each child in StaggerItem. */
export function Stagger({ children, className, gap = 0.09 }: { children: ReactNode; className?: string; gap?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : "off"}
      whileInView="on"
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ staggerChildren: gap }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ off: { opacity: 0, y: 30 }, on: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE } } }}
    >
      {children}
    </motion.div>
  );
}

/** A curtain reveal: the frame unclips upward while the content settles from a slight zoom. */
export function Curtain({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
      viewport={{ once: true, margin: "-6% 0px" }}
      transition={{ duration: 1.15, ease: EASE, delay }}
    >
      <motion.div
        style={{ height: "100%" }}
        initial={{ scale: 1.16 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "-6% 0px" }}
        transition={{ duration: 1.5, ease: EASE, delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Drifts vertically against the scroll, for depth. */
export function Parallax({
  children,
  amount = 36,
  className,
  style,
}: {
  children: ReactNode;
  amount?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  return (
    <motion.div ref={ref} className={className} style={reduced ? style : { ...style, y }}>
      {children}
    </motion.div>
  );
}

/** An endless single-row marquee. Pure CSS animation; pauses under reduced motion. */
export function Marquee({ items }: { items: readonly string[] }) {
  const row = [...items, ...items];
  return (
    <div className="lp-marquee" aria-hidden="true">
      <div className="lp-marquee-track">
        {row.map((item, i) => (
          <span className="lp-marquee-item" key={i}>
            {item}
            <span className="lp-marquee-dot" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Chat bubbles that arrive one at a time once the card is on screen. */
export function ArrivingLines({
  lines,
  interval = 1500,
  renderLine,
}: {
  lines: readonly { who: string; text: string }[];
  interval?: number;
  renderLine: (line: { who: string; text: string }, i: number) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { amount: 0.35, once: true });
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reduced) {
      setCount(lines.length);
      return;
    }
    if (!inView) return;
    setCount(1);
    const id = setInterval(() => {
      setCount((v) => {
        if (v >= lines.length) {
          clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, interval);
    return () => clearInterval(id);
  }, [inView, reduced, lines.length, interval]);

  return (
    <div ref={ref} style={{ display: "grid", gap: "0.55rem" }}>
      {lines.slice(0, count).map((line, i) => (
        <motion.div
          key={i}
          initial={reduced ? false : { opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {renderLine(line, i)}
        </motion.div>
      ))}
    </div>
  );
}
