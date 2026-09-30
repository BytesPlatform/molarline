/**
 * The end of a trial. The account still exists and everything they set
 * up is still there; sales can extend it in a click, so the wording
 * points at a conversation rather than a dead end.
 */
import { authConfigured } from "@/lib/auth";
import SignOutLink from "@/app/components/SignOutLink";
import { PRODUCT } from "@/lib/product";

export const dynamic = "force-dynamic";

export default function Expired() {
  return (
    <main className="notice">
      <div className="notice-card">
        <h1 className="notice-title">Your trial has finished</h1>
        <p className="notice-body">
          Thanks for trying {PRODUCT.name}. Everything you set up is saved, so if you would like longer with it, or
          want to talk about what a build for your business would look like, reply to the email that gave you access
          and we will pick it up from there.
        </p>
        <div className="notice-actions">
          <a className="btn btn-quiet" href={`mailto:${PRODUCT.salesInbox}?subject=${encodeURIComponent("More time with the trial")}`}>
            Email us
          </a>
          {authConfigured() ? <SignOutLink label="Sign out" /> : null}
        </div>
      </div>
    </main>
  );
}
