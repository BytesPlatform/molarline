# Shared code across the three products

The dental, HVAC and legal intake products are separate repos, deployments
and databases by decision (see PRODUCT_PLAN.md, section 13). Features that
are the same in all three are built once and copied, file for file, under
the same names. This file records what is shared and which version each
repo carries, so a fix made in one can be diffed into the others.

| Folder or file | Purpose | Version here | Origin |
|---|---|---|---|
| `demo/lib/tenancy.ts` | tenant context, tenants and memberships | 0.1 (2026-09-25), copied from hvac | hvac |
| `demo/lib/auth.ts` | Clerk session, platform admins, invitations | 0.1 | hvac |
| `demo/lib/scope.ts` | which tenant an API request reads | 0.1 | hvac |
| `demo/proxy.ts` | route protection for /app and /admin | 0.1 | hvac |
| `demo/app/admin/**` | the admin console | 0.1 | hvac |
| `demo/app/sign-in`, `demo/app/sign-up` | Clerk pages | 0.1 | hvac |
| `demo/app/app/**` | the signed-in workspace shell | 0.1 | hvac |
| `demo/app/components/AccountChip.tsx` | who is signed in | 0.1 | hvac |
| `demo/docs/auth-setup.md` | Clerk and admin setup | 0.1 | hvac |
| `demo/lib/messaging/email.ts` | SendGrid send, preview mode, event handling | 0.1 (2026-09-28) | hvac |
| `demo/lib/jobs.ts` | jobs table, worker, retries | 0.1 (2026-09-28) | hvac |
| `demo/lib/leads.ts` | demo requests, auto-reply, follow-up sequence, convert to tenant | 0.1 (2026-09-28) | hvac |
| `demo/emails/**` | React Email templates (Layout, LeadNotification, LeadAutoReply, LeadFollowUp) | 0.1 (2026-09-28) | hvac |
| `demo/app/api/leads`, `demo/app/api/jobs/run`, `demo/app/api/sendgrid/events` | the public form endpoint, the cron worker, the SendGrid webhook | 0.1 (2026-09-28) | hvac |
| `demo/app/admin/leads/**`, `demo/app/admin/jobs/**` | demo requests and job log in the console | 0.1 (2026-09-28) | hvac |
| `demo/app/(site)/**` | the marketing site shell, components and stylesheet; page copy is product-specific | 0.1 (2026-09-28) | hvac |

Product-specific by design: `lib/product.ts`, `lib/recordings.ts`, the copy inside `app/(site)/*/page.tsx`, `lib/config.ts`, `lib/tools.ts`, `lib/schema.ts`
(the vertical's tables), `retell/`, the dashboard panels, the seed.

When copying: bring the file over unchanged, then adapt the imports and the
few product words (the cookie name in `lib/auth.ts`, the table list in
`lib/schema.ts`), bump the version in the target repo's SHARED.md, and run
the smoke test.
