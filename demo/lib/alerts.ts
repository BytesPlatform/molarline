/**
 * Error alerting: when something breaks in the background, our own team
 * hears about it by email, at most once an hour so a crash loop does not
 * become an inbox flood. Shared across the three products.
 */

import { createElement } from "react";
import { OwnerEvent } from "@/emails/Notify";
import { platformAdminEmails } from "./auth";
import { q } from "./db";
import { sendEmail } from "./messaging/email";
import { PRODUCT } from "./product";

export async function alertPlatform(subject: string, lines: string[]): Promise<void> {
  try {
    const admins = platformAdminEmails();
    if (!admins.length) return;
    const [recent] = await q<{ n: number }>(
      `select count(*)::int as n from messages where template = 'platform_alert' and created_at > now() - interval '60 minutes'`,
    );
    if ((recent?.n ?? 0) > 0) return;
    for (const to of admins) {
      await sendEmail({
        to,
        subject: `[${PRODUCT.name}] ${subject}`,
        template: "platform_alert",
        react: createElement(OwnerEvent, {
          firstName: "team",
          title: subject,
          lines,
          ctaLabel: "Open the job log",
          ctaPath: "/admin/jobs",
        }),
      });
    }
  } catch {
    /* an alert that cannot send must never break the thing it reports on */
  }
}
