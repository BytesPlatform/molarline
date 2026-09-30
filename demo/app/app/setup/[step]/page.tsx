import { notFound, redirect } from "next/navigation";
import Notice from "@/app/admin/Notice";
import { requireTenant } from "@/lib/auth";
import { stepById, stepIndex } from "@/lib/onboarding";
import { ONBOARDING_STEPS, configOf, type StepId } from "@/lib/tenant-config";
import { AccountForm, BehaviourForm, BusinessForm, ServicesForm } from "../forms";

export const dynamic = "force-dynamic";

export default async function StepPage({ params, searchParams }: { params: Promise<{ step: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { step } = await params;
  const notice = await searchParams;
  const def = stepById(step);
  if (!def) notFound();
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const i = stepIndex(def.id as StepId);
  // Steps unlock in order; jumping ahead sends you to the furthest one reached.
  if (i > c.onboarding.step) redirect(`/app/setup/${ONBOARDING_STEPS[Math.min(c.onboarding.step, ONBOARDING_STEPS.length - 1)].id}`);

  return (
    <>
      <p className="setup-kicker">Step {i + 1} of {ONBOARDING_STEPS.length}</p>
      <h1 className="admin-title">{def.title}</h1>
      <p className="admin-help setup-lead">{def.blurb}</p>
      <Notice ok={notice.ok} error={notice.error} />

      {def.id === "account" ? <AccountForm tenant={ctx.tenant} mode="setup" /> : null}
      {def.id === "business" ? <BusinessForm tenant={ctx.tenant} mode="setup" /> : null}
      {def.id === "services" ? <ServicesForm tenant={ctx.tenant} mode="setup" /> : null}
      {def.id === "behaviour" ? <BehaviourForm tenant={ctx.tenant} mode="setup" /> : null}
    </>
  );
}
