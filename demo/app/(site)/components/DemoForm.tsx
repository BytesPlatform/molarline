"use client";

/**
 * Book a demo. Name, business, phone, email, what they want it to do, and
 * the consent line. Posts to /api/leads; the sales inbox gets the details
 * and the prospect gets an auto-reply.
 */

import { useState } from "react";

export default function DemoForm({
  consentText,
  productName,
  example,
}: {
  consentText: string;
  productName: string;
  example: { name: string; business: string; message: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          business: data.get("business"),
          phone: data.get("phone"),
          email: data.get("email"),
          message: data.get("message"),
          consent: data.get("consent") === "on",
          website: data.get("website"),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
      setDone(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="s-form-done" role="status">
        <h3>Thanks. We will call you within one business day.</h3>
        <p className="s-p" style={{ margin: 0 }}>
          A confirmation is on its way to your inbox with a recorded call to listen to in the meantime. On the demo call
          you speak to the assistant yourself, set up on your own details.
        </p>
      </div>
    );
  }

  return (
    <form className="s-form" onSubmit={submit} noValidate>
      <div className="s-form-row">
        <label className="s-field">
          Your name
          <input name="name" required autoComplete="name" placeholder={example.name} />
        </label>
        <label className="s-field">
          Business
          <input name="business" autoComplete="organization" placeholder={example.business} />
        </label>
      </div>
      <div className="s-form-row">
        <label className="s-field">
          Phone
          <input name="phone" required type="tel" autoComplete="tel" placeholder="(847) 555-0100" />
        </label>
        <label className="s-field">
          Email
          <input name="email" required type="email" autoComplete="email" placeholder="you@business.com" />
        </label>
      </div>
      <label className="s-field">
        What do you want it to do?
        <textarea name="message" placeholder={example.message} />
      </label>
      <label className="s-hp" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="s-consent">
        <input type="checkbox" name="consent" required />
        <span>{consentText}</span>
      </label>
      {error ? <p className="s-form-error">{error}</p> : null}
      <div className="s-btn-row">
        <button className="s-btn s-btn-primary" type="submit" disabled={busy}>
          {busy ? "Sending" : `Book a ${productName} demo`}
        </button>
      </div>
    </form>
  );
}
