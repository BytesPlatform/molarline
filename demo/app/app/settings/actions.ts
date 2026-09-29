"use server";

/** Settings-only actions: inviting a teammate. */

import { redirect } from "next/navigation";
import { requestOrigin, requireTenant, sendInvitation } from "@/lib/auth";
import { addMembership, recordInvitation } from "@/lib/tenancy";

export async function inviteMemberAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  if (!email || !email.includes("@")) redirect(`/app/settings?error=${encodeURIComponent("That does not look like an email address.")}#team`);
  const member = await addMembership({ tenantId: ctx.tenant.id, email, name: name || undefined, role: "staff" });
  const origin = await requestOrigin();
  const sent = await sendInvitation({ email, tenantId: ctx.tenant.id, role: "staff", origin });
  await recordInvitation(member.id, sent);
  redirect(
    `/app/settings?ok=${encodeURIComponent(
      sent.status === "sent" ? `Invitation sent to ${email}.` : `Added ${email}; the invitation email is pending.`,
    )}#team`,
  );
}
