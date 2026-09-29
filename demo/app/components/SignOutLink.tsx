"use client";

/**
 * A way out. Every dead end a signed-in person can reach (no workspace,
 * suspended) carries this, so nobody is ever stuck in a session they
 * cannot leave.
 */

import { SignOutButton } from "@clerk/nextjs";

export default function SignOutLink({ label = "Sign out" }: { label?: string }) {
  return (
    <SignOutButton>
      <button className="btn btn-quiet" type="button">
        {label}
      </button>
    </SignOutButton>
  );
}
