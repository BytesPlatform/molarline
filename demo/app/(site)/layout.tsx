/**
 * The marketing site's frame. Every page in this group gets the header,
 * the footer and the light stylesheet. The dashboard, the demo and the
 * console live outside the group and keep their own look.
 */
import { PRODUCT } from "@/lib/product";
import "./site.css";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="site"
      style={
        {
          "--s-accent": PRODUCT.accent.main,
          "--s-accent-deep": PRODUCT.accent.deep,
          "--s-accent-soft": `color-mix(in srgb, ${PRODUCT.accent.main} 11%, transparent)`,
          "--s-gradient-from": PRODUCT.accent.gradientFrom,
          "--s-gradient-to": PRODUCT.accent.gradientTo,
        } as React.CSSProperties
      }
    >
      <header className="s-header">
        <div className="s-wrap">
          <a className="s-logo" href="/">
            <span className="s-logo-mark" aria-hidden="true">
              {PRODUCT.name.slice(0, 1)}
            </span>
            {PRODUCT.name}
          </a>
          <nav className="s-nav" aria-label="Site">
            <a href="/how-it-works">How it works</a>
            <a href="/pricing">Pricing</a>
            <a href="/security">Security</a>
            <a href="/demo">Live demo</a>
            <a className="s-btn s-btn-primary" href="/book-a-demo">
              Book a demo
            </a>
          </nav>
        </div>
      </header>

      {children}

      <footer className="s-footer">
        <div className="s-wrap">
          <span>
            {PRODUCT.name} by {PRODUCT.company}
          </span>
          <nav aria-label="Legal">
            <a href="/handover">When a person takes over</a>
            <a href="/security">Security</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href={`mailto:${PRODUCT.salesInbox}`}>Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
