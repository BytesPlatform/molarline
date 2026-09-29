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
| `demo/lib/onboarding.ts`, `demo/emails/Onboarding.tsx` | onboarding state, welcome and nudge emails, go-live sequence | 0.1 (2026-09-28), copied from hvac | hvac |
| `demo/lib/provision.ts` | render flow and agent from the tenant, create/update/publish on Retell, buy a number | product-specific facts renderer | hvac |
| `demo/app/app/setup/**`, `demo/app/app/settings/**` | the eight onboarding steps and Settings; forms, actions and the test checklist are product-specific. Settings gained Messaging, Team and Plan/billing (0.2, 2026-09-29) | 0.2 (2026-09-29) | hvac |
| `demo/app/app/{layout,shared,fmt,home-actions}.ts(x)`, `demo/app/app/{page,calls/page}.tsx`, `demo/app/components/dash/Shell.tsx`, the dash-* block in `app/globals.css` | the phase-3 customer dashboard shell, Home and Calls; shared verbatim. `lib/dash.ts`, `lib/dash-examples.ts`, `app/app/schedule/**` and `app/app/advanced/page.tsx` are product-specific (different tables, numbers and boards) | 0.1 (2026-09-29) | hvac |
| `emails/Notify.tsx`, `lib/notify.ts`, `app/api/twilio/inbound`, `app/api/jobs/run`, `lib/jobs.ts` | phase 4 messaging: owner notifications, the STOP webhook, the widened job kinds; shared verbatim. `lib/automation.ts`, `dayStats` in `lib/stats.ts`, the consent/suppression layer (`lib/sms.ts`, PI `lib/messages.ts`) and the notify triggers in `lib/tools.ts` and the post-call webhook are product-specific | 0.1 (2026-09-29) | hvac |
| `lib/{ratelimit,secretbox,usage,alerts}.ts`, `app/admin/usage/**`, `docs/sms-golive.md`, the secret helpers in `lib/tenancy.ts` | phase 5 hardening: durable rate limits, sealed integration tokens, usage metering with the admin view and CSV, failed-job alerting, the SMS go-live doc; shared verbatim. The retention pass in `lib/automation.ts` and `tests/load.ts` are product-specific | 0.1 (2026-09-29) | hvac |
| `demo/app/(site)/**` | the marketing site shell, components and stylesheet; page copy is product-specific. Landing v3 (motion.tsx, components/home/Hero.tsx + CallCard.tsx, the lp-* layer in site.css, public/landing/hero.jpg is product-specific art, headlineParts in lib/product.ts) | 0.3 (2026-09-29) | hvac |

Product-specific by design: `lib/tenant-config.ts` and `lib/stats.ts` (what onboarding collects and what the weekly report counts), `lib/product.ts`, `lib/recordings.ts`, the copy inside `app/(site)/*/page.tsx`, `lib/config.ts`, `lib/tools.ts`, `lib/schema.ts`
(the vertical's tables), `retell/`, the dashboard panels, the seed.

When copying: bring the file over unchanged, then adapt the imports and the
few product words (the cookie name in `lib/auth.ts`, the table list in
`lib/schema.ts`), bump the version in the target repo's SHARED.md, and run
the smoke test.
