"use client";

/**
 * The dashboard frame: a slim sidebar with four destinations, a top bar
 * with the greeting, the one main button and the theme toggle, and the
 * page's content. Light by default; the toggle is remembered per user.
 *
 * Shared across the three products.
 */

import { useEffect, useState, type ReactNode } from "react";
import AccountChip, { type Account } from "@/app/components/AccountChip";
import { PRODUCT } from "@/lib/product";

export type DashPage = "home" | "calls" | "schedule" | "settings";

const NAV: { id: DashPage; href: string; label: string; icon: ReactNode }[] = [
  {
    id: "home",
    href: "/app",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 4l8 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 10.5V20h11v-9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "calls",
    href: "/app/calls",
    label: "Calls",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 4h3.5l1.5 4.5-2.2 1.6a12 12 0 0 0 6.1 6.1l1.6-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.4 20 4 13.6 3.5 5.6A1.5 1.5 0 0 1 5 4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "schedule",
    href: "/app/schedule",
    label: "Schedule",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5.5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "settings",
    href: "/app/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 3.5v2.4m0 12.2v2.4M20.5 12h-2.4M5.9 12H3.5m14.5-6-1.7 1.7M7.7 16.3 6 18m12 0-1.7-1.7M7.7 7.7 6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("dash_theme", next);
    } catch {
      /* a private window forgets; the page still switches */
    }
  };
  return (
    <button type="button" className="btn btn-quiet dash-theme" onClick={flip} aria-label="Switch theme">
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

function Greeting({ name }: { name: string }) {
  // Time-of-day is the browser's; rendered after mount so the server HTML never disagrees.
  const [word, setWord] = useState("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    setWord(h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return (
    <div className="dash-greet">
      <span className="dash-greet-title">
        {word}, {name}
      </span>
      <span className="dash-greet-sub">{PRODUCT.name} is answering your line</span>
    </div>
  );
}

export default function Shell({
  active,
  account,
  children,
}: {
  active: DashPage;
  account: Account;
  children: ReactNode;
}) {
  return (
    <div className="dash">
      <aside className="dash-side">
        <a className="dash-brand" href="/app">
          <span className="brand-mark" aria-hidden="true">
            {PRODUCT.name.slice(0, 1)}
          </span>
          <span className="dash-brand-name">{PRODUCT.name}</span>
        </a>
        <nav className="dash-nav" aria-label="Dashboard">
          {NAV.map((item) => (
            <a key={item.id} className={`dash-nav-item${item.id === active ? " is-active" : ""}`} href={item.href}>
              <span className="dash-nav-icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="dash-side-foot">
          <AccountChip account={account} />
        </div>
      </aside>
      <div className="dash-stage">
        <header className="dash-top">
          <Greeting name={account.tenantName} />
          <div className="dash-top-end">
            <ThemeToggle />
            <a className="btn btn-cta" href="/app/setup/test">
              Start test call
            </a>
          </div>
        </header>
        <main className="dash-main">{children}</main>
      </div>
    </div>
  );
}
