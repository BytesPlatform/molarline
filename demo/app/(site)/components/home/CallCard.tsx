"use client";

/**
 * The example call, played out: the transcript arrives bubble by bubble
 * once the card scrolls into view. Sits beside the recordings.
 *
 * Shared across the three products; every word comes from lib/product.ts.
 */

import { PRODUCT } from "@/lib/product";
import { ArrivingLines } from "../../motion";

export default function CallCard({ lines }: { lines: { who: string; text: string }[] }) {
  return (
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
  );
}
