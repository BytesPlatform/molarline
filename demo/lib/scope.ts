/**
 * Which tenant an API request reads.
 *
 * The browser may only ever ask for two things: the public demo, or "mine".
 * It never names a tenant. "Mine" is resolved from the session, the same way
 * the /app page resolves it, so the screen and its data always agree.
 */

import { NextResponse, type NextRequest } from "next/server";
import { demoAccess, getSession, resolveTenant, type TenantContext } from "./auth";
import { DEMO_TENANT_ID, getTenant, type Tenant } from "./tenancy";

export type Scope = "demo" | "app";

export function scopeOf(request: NextRequest): Scope {
  return request.nextUrl.searchParams.get("scope") === "app" ? "app" : "demo";
}

export async function tenantForRequest(
  request: NextRequest,
): Promise<{ tenant: Tenant; ctx: TenantContext | null; scope: Scope } | NextResponse> {
  const scope = scopeOf(request);

  if (scope === "demo") {
    // A session alone is not enough: the demo needs an invited membership
    // or a platform admin, so a bare account unlocks nothing.
    if (!(await demoAccess())) return NextResponse.json({ error: "not found" }, { status: 404 });
    const tenant = await getTenant(DEMO_TENANT_ID);
    if (!tenant) return NextResponse.json({ error: "demo tenant missing" }, { status: 500 });
    return { tenant, ctx: null, scope };
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const ctx = await resolveTenant(session);
  if (!ctx) return NextResponse.json({ error: "no workspace for this account" }, { status: 403 });
  return { tenant: ctx.tenant, ctx, scope };
}
