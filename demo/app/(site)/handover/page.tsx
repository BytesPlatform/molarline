import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `When a person takes over | ${PRODUCT.name}`,
  description: `The rules ${PRODUCT.name} will not cross, and exactly what happens when a call needs a person.`,
  alternates: { canonical: "/handover" },
};

export default function Handover() {
  return (
    <main className="s-section">
      <div className="s-wrap s-prose">
        <p className="s-kicker">When a person takes over</p>
        <h1 className="s-h2">It knows what it is not allowed to do</h1>
        <p>
          An assistant that tries to handle everything ends up promising things you cannot deliver. {PRODUCT.name} works
          inside rules you set, and when a call crosses one it hands over. These are the defaults; you change them in
          onboarding.
        </p>

        <h2 className="s-h2">The lines it will not cross</h2>
        <ul>
          {[...PRODUCT.rules, ...PRODUCT.moreRules].map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>

        <h2 className="s-h2">The {PRODUCT.handover.length} ways a call reaches a person</h2>
        {PRODUCT.handover.map((h) => (
          <div key={h.title}>
            <h3>{h.title}</h3>
            <p>{h.body}</p>
          </div>
        ))}

        <h2 className="s-h2">What you can read afterwards</h2>
        <p>
          Every call has a transcript and a step-by-step log of what the assistant checked and decided. If it ever gets
          one wrong, you can see exactly where, and change the rule.
        </p>
      </div>
    </main>
  );
}
