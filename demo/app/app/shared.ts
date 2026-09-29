/**
 * What every dashboard page needs: the signed-in workspace, redirected to
 * setup while onboarding is unfinished, and the account for the shell.
 */
import { redirect } from "next/navigation";
import { authConfigured, requireTenant, type TenantContext } from "@/lib/auth";
import { DEMO_TENANT_ID } from "@/lib/tenancy";
import { configOf, onboardingComplete } from "@/lib/tenant-config";
import type { Account } from "@/app/components/AccountChip";

export async function requireDashboard(): Promise<TenantContext> {
  const ctx = await requireTenant();
  // A workspace that has not finished setup opens on the setup, not on an empty dashboard.
  if (!ctx.viewingAs && ctx.tenant.id !== DEMO_TENANT_ID && !onboardingComplete(configOf(ctx.tenant))) redirect("/app/setup");
  return ctx;
}

export function accountOf(ctx: TenantContext): Account {
  return {
    email: ctx.session.email ?? "",
    name: ctx.session.name,
    tenantName: ctx.tenant.name,
    clerk: authConfigured() && !ctx.session.dev,
    viewingAs: ctx.viewingAs,
    admin: ctx.admin,
  };
}
