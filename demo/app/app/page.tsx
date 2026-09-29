/**
 * The product. Sign-in required; the workspace is the one the signed-in
 * person belongs to. A platform admin can open any workspace from /admin.
 */
import { redirect } from "next/navigation";
import Desk from "@/app/components/Desk";
import { authConfigured, requireTenant } from "@/lib/auth";
import { DEMO_TENANT_ID } from "@/lib/tenancy";
import { configOf, onboardingComplete } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const ctx = await requireTenant();
  // A workspace that has not finished setup opens on the setup, not on an empty dashboard.
  if (!ctx.viewingAs && ctx.tenant.id !== DEMO_TENANT_ID && !onboardingComplete(configOf(ctx.tenant))) redirect("/app/setup");

  return (
    <Desk
      scope="app"
      canReset={ctx.admin}
      account={{
        email: ctx.session.email ?? "",
        name: ctx.session.name,
        tenantName: ctx.tenant.name,
        clerk: authConfigured() && !ctx.session.dev,
        viewingAs: ctx.viewingAs,
        admin: ctx.admin,
      }}
    />
  );
}
