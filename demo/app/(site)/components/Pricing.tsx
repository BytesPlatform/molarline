import { PRODUCT } from "@/lib/product";

export default function Pricing({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <div className="s-plans">
        {PRODUCT.plans.map((plan) => (
          <div key={plan.id} className={`s-plan${"popular" in plan && plan.popular ? " s-plan-popular" : ""}`}>
            {"popular" in plan && plan.popular ? <span className="s-plan-flag">Most chosen</span> : null}
            <span className="s-plan-name">{plan.name}</span>
            <span className="s-plan-price">
              {"from" in plan && plan.from ? <small>from </small> : null}${plan.price}
              <small> a month</small>
            </span>
            <span className="s-plan-min">{plan.minutes.toLocaleString()} minutes included</span>
            <p className="s-p" style={{ margin: 0 }}>
              {plan.blurb}
            </p>
            <a className={`s-btn${"popular" in plan && plan.popular ? " s-btn-primary" : ""}`} href="/book-a-demo">
              Book a demo
            </a>
          </div>
        ))}
      </div>
      {!compact ? (
        <p className="s-note">
          Overage ${PRODUCT.overagePerMinute.toFixed(2)} a minute. No setup fee: onboarding is the setup. No contract
          longer than a month. Every plan starts with a demo call, and the first month can be discounted when it should be.
        </p>
      ) : null}
    </>
  );
}
