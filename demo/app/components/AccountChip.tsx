"use client";

/**
 * Who is signed in, at the foot of the sidebar. With Clerk configured the
 * chip is Clerk's own user button (profile, sign out). In the development
 * bypass it is a plain label.
 */

import { UserButton } from "@clerk/nextjs";

export interface Account {
  email: string;
  name: string | null;
  tenantName: string;
  /** True when Clerk is carrying the session. */
  clerk: boolean;
  /** Set when a platform admin is looking at a workspace they are not a member of. */
  viewingAs: boolean;
  admin: boolean;
}

export default function AccountChip({ account }: { account: Account }) {
  const initials = (account.name || account.email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className="account">
      {account.clerk ? (
        <UserButton appearance={{ elements: { avatarBox: { width: "2rem", height: "2rem" } } }} />
      ) : (
        <span className="account-mark" aria-hidden="true">
          {initials}
        </span>
      )}
      <span className="account-text">
        <span className="account-name">{account.name || account.email}</span>
        <span className="account-sub">
          {account.viewingAs ? `Viewing ${account.tenantName}` : account.tenantName}
        </span>
      </span>
      <a className="account-admin" href="/demo" title="The live demo, on the fictional demo business">
        Demo
      </a>
      <a className="account-admin" href="/app/settings" title="Settings">
        Settings
      </a>
      {account.admin ? (
        <a className="account-admin" href="/admin" title="Admin console">
          Admin
        </a>
      ) : null}
    </div>
  );
}
