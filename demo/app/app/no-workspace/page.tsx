import { requireSession } from "@/lib/auth";
import { resolveTenant } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NoWorkspace() {
  const session = await requireSession();
  if (await resolveTenant(session)) redirect("/app");

  return (
    <main className="notice">
      <div className="notice-card">
        <h1 className="notice-title">No workspace yet</h1>
        <p className="notice-body">
          You are signed in as <strong>{session.email}</strong>, but that address has not been added to a
          workspace. Invitations are sent by our team after a setup call; if you were expecting one, reply to the
          invitation email or contact the person who set you up.
        </p>
        <a className="btn btn-quiet" href="/demo">
          Back to the demo
        </a>
      </div>
    </main>
  );
}
