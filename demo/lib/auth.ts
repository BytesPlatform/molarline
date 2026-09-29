/**
 * Who is asking.
 *
 * Clerk carries sign-in, sessions and invitation emails. Public sign-up is
 * switched off in the Clerk dashboard (Restricted mode), so an account exists
 * only when the admin console invites it. This file is the one place the
 * rest of the code talks to Clerk, so swapping the provider later touches
 * nothing else.
 *
 * Without Clerk keys the product routes stay closed. The one exception is
 * AUTH_DEV_USER, honoured only in development and only when no Clerk key is
 * present, so /app and /admin can be worked on locally before the Clerk
 * application exists.
 *
 * Copied and adapted across the three products. Keep the file name.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_TENANT_ID, getTenant, membershipsForUser, type Membership, type Tenant } from "./tenancy";

export interface Session {
  userId: string;
  email: string | null;
  name: string | null;
  /** True when the session came from the development bypass, not Clerk. */
  dev: boolean;
}

export const TENANT_COOKIE = "dental_tenant";

export function authConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

function devUser(): Session | null {
  if (process.env.NODE_ENV === "production" || authConfigured()) return null;
  const email = process.env.AUTH_DEV_USER?.trim().toLowerCase();
  if (!email) return null;
  return { userId: `dev_${email}`, email, name: email.split("@")[0], dev: true };
}

export async function getSession(): Promise<Session | null> {
  const dev = devUser();
  if (dev) return dev;
  if (!authConfigured()) return null;

  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const primary = user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? user?.emailAddresses[0];
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  return { userId, email: primary?.emailAddress?.toLowerCase() ?? null, name, dev: false };
}

export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(session: Session | null): boolean {
  if (!session?.email) return false;
  return platformAdminEmails().includes(session.email);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Our own team only. Anyone else gets the sign-in page or a 404. */
export async function requirePlatformAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!isPlatformAdmin(session)) redirect("/app");
  return session;
}

/**
 * Whether the signed-in person may use the live demo: an invited member or
 * a platform admin. A session alone is not enough, because sign-up may be
 * open at the provider and a bare account must unlock nothing. Deployments
 * without Clerk keys stay open so the demo can be worked on before the
 * Clerk application exists.
 */
export async function demoAccess(): Promise<boolean> {
  if (!authConfigured()) return true;
  const session = await getSession();
  if (!session) return false;
  if (isPlatformAdmin(session)) return true;
  const memberships = await membershipsForUser({ id: session.userId, email: session.email });
  return memberships.length > 0;
}

export interface TenantContext {
  session: Session;
  tenant: Tenant;
  membership: Membership | null;
  /** True when a platform admin opened a workspace they are not a member of. */
  viewingAs: boolean;
  admin: boolean;
}

/**
 * The workspace for the signed-in person, or null when they have none.
 * Several memberships are disambiguated by the tenant cookie, which the
 * admin console also uses to open a customer's workspace for support.
 */
export async function resolveTenant(session: Session): Promise<TenantContext | null> {
  const admin = isPlatformAdmin(session);
  const jar = await cookies();
  const chosen = jar.get(TENANT_COOKIE)?.value ?? null;
  const memberships = await membershipsForUser({ id: session.userId, email: session.email });

  const mine = (chosen && memberships.find((m) => m.tenant_id === chosen)) || memberships[0] || null;
  if (mine) {
    const t = await getTenant(mine.tenant_id);
    if (t) return { session, tenant: t, membership: mine, viewingAs: false, admin };
  }

  if (admin) {
    const t = await getTenant(chosen || DEMO_TENANT_ID);
    if (t) return { session, tenant: t, membership: null, viewingAs: true, admin };
  }

  return null;
}

export async function requireTenant(): Promise<TenantContext> {
  const session = await requireSession();
  const ctx = await resolveTenant(session);
  if (!ctx) redirect("/app/no-workspace");
  if (ctx.tenant.status === "suspended" && !ctx.admin) redirect("/app/suspended");
  return ctx;
}

/** The origin of the current request, for links inside invitation emails. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/**
 * Sends the Clerk invitation email. The membership row is the record; Clerk
 * is only the postman. Returns what to store on the row.
 */
export async function sendInvitation(input: {
  email: string;
  tenantId: string;
  role: string;
  origin: string;
}): Promise<{ status: "sent"; invitationId: string } | { status: "failed"; error: string } | { status: "pending" }> {
  if (!authConfigured()) return { status: "pending" };
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const invitation = await client.invitations.createInvitation({
      emailAddress: input.email,
      redirectUrl: `${input.origin}/sign-up`,
      publicMetadata: { tenant_id: input.tenantId, role: input.role },
      notify: true,
      ignoreExisting: true,
    });
    return { status: "sent", invitationId: invitation.id };
  } catch (err) {
    const message =
      (err as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0]?.longMessage ??
      (err instanceof Error ? err.message : "unknown error");
    return { status: "failed", error: message };
  }
}
