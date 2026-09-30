"use server";

/** The test call's checklist, saved so it survives a reload. */

import { requireTenant } from "@/lib/auth";
import { saveConfig } from "@/lib/onboarding";
import { configOf } from "@/lib/tenant-config";

export async function saveChecklistAction(callId: string, checklist: Record<string, boolean>): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  await saveConfig(ctx.tenant.id, {
    onboarding: { ...c.onboarding, testCallId: callId, checklist: { ...c.onboarding.checklist, ...checklist } },
  });
}
