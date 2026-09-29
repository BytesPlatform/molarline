/**
 * Owner notifications: the moments the plan says the owner hears about
 * right away. Sent immediately (the messages table is the record and the
 * retry surface); a notification that fails must never take down the call
 * that earned it. Shared across the three products.
 */

import { createElement } from "react";
import { OwnerEvent } from "@/emails/Notify";
import { sendEmail } from "./messaging/email";
import { listMemberships, type Tenant } from "./tenancy";

export async function owners(tenantId: string): Promise<{ email: string; firstName: string }[]> {
  const members = await listMemberships(tenantId);
  const own = members.filter((m) => m.role === "owner");
  const list = own.length ? own : members.slice(0, 1);
  return list.map((m) => ({ email: m.email, firstName: (m.name || m.email).split(/[\s@]/)[0] || "there" }));
}

export async function notifyOwners(
  t: Tenant,
  input: { template: string; subject: string; title: string; lines: string[]; ctaLabel?: string; ctaPath?: string },
): Promise<void> {
  try {
    for (const owner of await owners(t.id)) {
      await sendEmail({
        to: owner.email,
        subject: input.subject,
        template: input.template,
        tenantId: t.id,
        react: createElement(OwnerEvent, {
          firstName: owner.firstName,
          title: input.title,
          lines: input.lines,
          ctaLabel: input.ctaLabel,
          ctaPath: input.ctaPath,
        }),
      });
    }
  } catch {
    /* the messages table shows the failure; the call flow never does */
  }
}
