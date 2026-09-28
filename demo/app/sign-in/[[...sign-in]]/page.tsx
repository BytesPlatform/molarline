import { SignIn } from "@clerk/nextjs";
import { authConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (!authConfigured()) {
    return (
      <main className="notice">
        <div className="notice-card">
          <h1 className="notice-title">Sign-in is not set up yet</h1>
          <p className="notice-body">
            This deployment has no Clerk keys, so the product pages are closed. The public demo still works.
            See docs/auth-setup.md.
          </p>
          <a className="btn btn-quiet" href="/demo">
            Back to the demo
          </a>
        </div>
      </main>
    );
  }
  return (
    <main className="notice">
      <SignIn fallbackRedirectUrl="/app" />
    </main>
  );
}
