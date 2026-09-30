# MolarLine

**Keep every chair full, without adding to the front desk.** An AI receptionist for dental practices, sold as a standalone product by Bytes Platform.

Live: https://molarline.vercel.app

It answers every call with the recording notice the state requires, identifies the patient by name and date of birth, offers open chair time with the right provider at the right office, books it, records SMS consent, and hands anything clinical or financial to the desk. Every access to a patient record is written to an audit log with a pseudonym, never free text.

## What is in this repository

Everything lives in `demo/` (the folder name is historical; it is the whole product).

| Path | What it is |
|---|---|
| `/` | The marketing site: home with a recorded call, how it works, pricing, integrations, handover rules, security, privacy, terms, Book a demo |
| `/demo` | The public live demo. Anyone can call the assistant from the browser and watch the dashboard fill in. Answers as Riverside Family Dental, a fictional two-office practice. |
| `/app` | The product. Invite-only sign-in through Clerk; each customer sees only their own workspace |
| `/admin` | Our console: create customers, send invitations, open any workspace, demo requests, job log |
| `/api/retell/*` | Retell webhooks, signed, routed to the workspace that owns the agent |
| `/api/leads`, `/api/jobs/run`, `/api/sendgrid/events` | The Book a demo form, the scheduled worker, SendGrid delivery events |
| `demo/lib/product.ts` | Every word of site and email copy, the accent, the plans. The one file that makes this product this product |
| `demo/lib/config.ts`, `demo/lib/tools.ts`, `demo/retell/` | The assistant itself: rules, the tools it can call, the conversation flow |
| `demo/emails/` | React Email templates |
| `demo/docs/auth-setup.md` | Clerk and admin console setup |
| `SHARED.md` | The register of files shared with the sister products, and the version each carries |

The three products (OnCallDesk, MolarLine, FirstIntake) are separate repositories, Vercel projects and databases by decision. Shared features are copied file for file and listed in `SHARED.md`.

## Running it locally

```bash
cd demo
cp .env.example .env.local     # see the comments in the file
npm install
npm run dev                    # http://localhost:3000
npm test                       # smoke test on an embedded database, no accounts needed
```

With no environment at all the site, the demo dashboard and the console all run on an embedded Postgres. Voice needs `RETELL_API_KEY`, `NEXT_PUBLIC_RETELL_PUBLIC_KEY` and `NEXT_PUBLIC_RETELL_AGENT_ID`. Sign-in needs the Clerk keys and `PLATFORM_ADMIN_EMAILS`, or `AUTH_DEV_USER` for local work. Email stays in preview mode until `SENDGRID_API_KEY` and a verified `SENDGRID_FROM_EMAIL` exist. Product-specific: PATIENT_HASH_SALT (change before any deploy), TWILIO_* (optional).

## Deploying

Vercel project `molarline`, root directory `demo`, environment from `.env.example`. The database is Neon (`DATABASE_URL`, pooled string); the schema creates and migrates itself on the first request. The Retell agent is `agent_f4e4397ac44475cb956fd1fe13`; after any change to `retell/demo-flow.json` or `retell/demo-agent.json`:

```bash
RETELL_API_KEY=key_... DEMO_HOST=molarline.vercel.app npm run push:retell
```

The worker runs from Vercel Cron every five minutes with `CRON_SECRET`. One SendGrid event webhook serves all three products; see the comment in `demo/app/api/sendgrid/events/route.ts`.

## Where the build is

Done: tenancy and invite-only sign-in (phase 0), the marketing site, demo requests, email and the worker (phase 1). Next: onboarding inside the product with agent and number provisioning (phase 2), then the simplified dashboard, messaging and usage. The phase list and estimates are in the product plan kept alongside the three repositories.

The recorded call on the site is synthetic (two neural voices) and will be replaced by a real call to this agent once phone numbers exist. The demo business, its staff and its customers are invented.
