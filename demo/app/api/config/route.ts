/**
 * Public configuration for the call widget. The Retell public key is designed
 * to be visible in the browser; the API key never leaves the server. With
 * ?scope=app the agent is the signed-in workspace's own.
 */
import { NextRequest, NextResponse } from "next/server";
import { PRACTICE } from "@/lib/config";
import { configOf } from "@/lib/tenant-config";
import { connectionSource, databaseMode, databaseWarning } from "@/lib/db";
import { tenantForRequest } from "@/lib/scope";
import { DEMO_TENANT_ID } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resolved = await tenantForRequest(request);
  if (resolved instanceof NextResponse) return resolved;
  const { tenant } = resolved;
  const c = configOf(tenant);

  const agentId = tenant.retell_agent_id ?? (tenant.id === DEMO_TENANT_ID ? process.env.NEXT_PUBLIC_RETELL_AGENT_ID ?? "" : "");
  const phoneNumber = tenant.phone_number ?? (tenant.id === DEMO_TENANT_ID ? process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER ?? "" : "");

  return NextResponse.json({
    practice: {
      ...PRACTICE,
      name: tenant.name,
      shortName: tenant.short_name,
      tagline: tenant.tagline ?? PRACTICE.tagline,
      callbackNumber: c.basics.callbackNumber || tenant.main_number || PRACTICE.callbackNumber,
      timezone: tenant.timezone,
    },
    tenant: { id: tenant.id, status: tenant.status, plan: tenant.plan },
    locations: c.offices,
    database: { mode: databaseMode(), source: connectionSource(), warning: databaseWarning() },
    retell: {
      publicKey: process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY ?? "",
      agentId,
      phoneNumber,
      configured: Boolean(process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY && agentId),
    },
  });
}
