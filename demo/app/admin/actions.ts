"use server";

/**
 * What the admin console can do. Every action re-checks that the caller is
 * on the platform team; the page guard alone is not enough for a mutation.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TENANT_COOKIE, requestOrigin, requirePlatformAdmin, sendInvitation } from "@/lib/auth";
import { resetTenant } from "@/lib/db";
import { retryJob, runDueJobs } from "@/lib/jobs";
import { convertLead, setLeadNotes, setLeadStatus, type LeadStatus } from "@/lib/leads";
import {
  addMembership,
  createTenant,
  getMembership,
  getTenant,
  recordInvitation,
  removeMembership,
  updateTenant,
  type TenantStatus,
} from "@/lib/tenancy";

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function back(path: string, notice: string, kind: "ok" | "error" = "ok"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(notice)}`);
}

async function invite(membershipId: number, tenantId: string, email: string, role: string): Promise<string> {
  const origin = await requestOrigin();
  const result = await sendInvitation({ email, tenantId, role, origin });
  await recordInvitation(membershipId, result);
  if (result.status === "sent") return `Invitation emailed to ${email}.`;
  if (result.status === "failed") return `Invitation to ${email} failed: ${result.error}`;
  return `${email} added. Clerk is not configured on this deployment, so no email went out; the invitation can be resent once it is.`;
}

export async function createTenantAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();

  const name = text(form, "name");
  const ownerEmail = text(form, "owner_email").toLowerCase();
  if (!name) back("/admin", "Business name is required.", "error");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) back("/admin", "A valid owner email is required.", "error");

  const tenant = await createTenant({
    name,
    shortName: text(form, "short_name") || undefined,
    tagline: text(form, "tagline") || undefined,
    mainNumber: text(form, "main_number") || undefined,
    timezone: text(form, "timezone") || undefined,
    plan: text(form, "plan") || undefined,
    includedMinutes: Number(text(form, "included_minutes")) || 0,
    retellAgentId: text(form, "retell_agent_id") || undefined,
    phoneNumber: text(form, "phone_number") || undefined,
  });

  const member = await addMembership({ tenantId: tenant.id, email: ownerEmail, name: text(form, "owner_name") || undefined, role: "owner" });
  const notice = form.get("send_invite") ? await invite(member.id, tenant.id, ownerEmail, "owner") : `${tenant.name} created. No invitation sent yet.`;
  back(`/admin/tenants/${tenant.id}`, notice, notice.includes("failed") ? "error" : "ok");
}

export async function updateTenantAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = text(form, "id");
  const tenant = await getTenant(id);
  if (!tenant) redirect("/admin");

  await updateTenant(id, {
    name: text(form, "name") || tenant.name,
    short_name: text(form, "short_name") || tenant.short_name,
    tagline: text(form, "tagline") || null,
    main_number: text(form, "main_number") || null,
    timezone: text(form, "timezone") || tenant.timezone,
    plan: text(form, "plan") || tenant.plan,
    included_minutes: Number(text(form, "included_minutes")) || 0,
    retell_agent_id: text(form, "retell_agent_id") || null,
    phone_number: text(form, "phone_number") || null,
  });
  back(`/admin/tenants/${id}`, "Saved.");
}

export async function setStatusAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = text(form, "id");
  const status = text(form, "status") as TenantStatus;
  if (!["invited", "active", "suspended"].includes(status)) back(`/admin/tenants/${id}`, "Unknown status.", "error");
  if (id === "demo" && status === "suspended") back(`/admin/tenants/${id}`, "The demo workspace cannot be suspended.", "error");
  await updateTenant(id, { status });
  back(`/admin/tenants/${id}`, `Status set to ${status}.`);
}

export async function inviteMemberAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = text(form, "tenant_id");
  const email = text(form, "email").toLowerCase();
  const role = text(form, "role") === "staff" ? "staff" : "owner";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back(`/admin/tenants/${tenantId}`, "A valid email is required.", "error");

  const member = await addMembership({ tenantId, email, name: text(form, "name") || undefined, role });
  const notice = await invite(member.id, tenantId, email, role);
  back(`/admin/tenants/${tenantId}`, notice, notice.includes("failed") ? "error" : "ok");
}

export async function resendInviteAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const member = await getMembership(Number(text(form, "membership_id")));
  if (!member) redirect("/admin");
  if (member.invite_status === "accepted") back(`/admin/tenants/${member.tenant_id}`, `${member.email} has already signed in.`);
  const notice = await invite(member.id, member.tenant_id, member.email, member.role);
  back(`/admin/tenants/${member.tenant_id}`, notice, notice.includes("failed") ? "error" : "ok");
}

export async function removeMemberAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const member = await getMembership(Number(text(form, "membership_id")));
  if (!member) redirect("/admin");
  await removeMembership(member.id);
  back(`/admin/tenants/${member.tenant_id}`, `${member.email} removed. Their Clerk account, if any, still exists.`);
}

export async function openWorkspaceAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = text(form, "id");
  if (!(await getTenant(id))) redirect("/admin");
  const jar = await cookies();
  jar.set(TENANT_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  redirect("/app");
}

export async function clearWorkspaceAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = text(form, "id");
  if (text(form, "confirm") !== id) back(`/admin/tenants/${id}`, "Type the workspace id to confirm clearing it.", "error");
  await resetTenant(id);
  back(`/admin/tenants/${id}`, id === "demo" ? "Demo reseeded." : "Workspace cleared.");
}

/* ------------------------------------------------------------ leads and jobs */

export async function setLeadStatusAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = Number(text(form, "id"));
  const status = text(form, "status") as LeadStatus;
  if (!["new", "contacted", "booked", "closed"].includes(status)) back(`/admin/leads/${id}`, "Unknown status.", "error");
  await setLeadStatus(id, status);
  back(`/admin/leads/${id}`, status === "new" ? "Marked new. Follow-ups already sent are not resent." : `Marked ${status}. Follow-up emails stopped.`);
}

export async function saveLeadNotesAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = Number(text(form, "id"));
  await setLeadNotes(id, text(form, "notes").slice(0, 4000));
  back(`/admin/leads/${id}`, "Notes saved.");
}

export async function convertLeadAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = Number(text(form, "id"));
  const tenant = await convertLead(id, {
    name: text(form, "name") || undefined,
    shortName: text(form, "short_name") || undefined,
    plan: text(form, "plan") || undefined,
    includedMinutes: Number(text(form, "included_minutes")) || 0,
  });
  back(`/admin/tenants/${tenant.id}`, `${tenant.name} created from the demo request. Send the owner's invitation below.`);
}

export async function runJobsNowAction(): Promise<void> {
  await requirePlatformAdmin();
  await import("@/lib/leads");
  const report = await runDueJobs();
  back("/admin/leads", `Ran ${report.claimed} due job${report.claimed === 1 ? "" : "s"}: ${report.done} done, ${report.retried} retried, ${report.failed} failed.`);
}

export async function retryJobAction(form: FormData): Promise<void> {
  await requirePlatformAdmin();
  await retryJob(Number(text(form, "id")));
  back("/admin/jobs", "Job queued again.");
}
