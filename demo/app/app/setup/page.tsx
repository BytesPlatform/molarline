import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { ONBOARDING_STEPS, configOf } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

/** Resume at the furthest step reached. */
export default async function SetupIndex() {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const i = Math.min(c.onboarding.step, ONBOARDING_STEPS.length - 1);
  redirect(`/app/setup/${ONBOARDING_STEPS[i].id}`);
}
