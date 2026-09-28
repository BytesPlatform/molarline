# Dental AI receptionist, sales demo

A working, self contained demo of a HIPAA minded AI phone receptionist for a
dental practice. It answers the phone as Riverside Family Dental, identifies a
patient by full name and date of birth, offers real open slots from a seeded
two week schedule, writes the appointment, asks for text reminder consent, and
refuses every clinical and billing topic by offering a transfer instead.

Everything the prospect sees on screen is real. The signature check, the audit
rows, the consent rows and the redaction toggle are the same code paths the
production build uses. What is not real is the practice: every patient in
`lib/seed.ts` is invented, and no practice management system is connected.

The demo is a cut down version of the production plan in `../PLAN.md`. The
differences that matter: no n8n, no NexHealth, no knowledge base, a 30 day
retention setting instead of 90, and the practice facts live in the agent
prompt rather than in a knowledge base.

## What is in here

```
app/api/retell/tool/route.ts       the endpoint the agent's tools POST to
app/api/retell/post-call/route.ts  the call lifecycle webhook
app/api/reset, state, redact       the demo console endpoints
lib/config.ts                      practice branding, the only file to rebrand
lib/tools.ts                       the eight tool handlers and nothing else
retell/demo-flow.json              the conversation flow, as a create request
retell/demo-agent.json             the agent, as a create request
retell/push-demo-config.ts         pushes both to Retell
tests/demo-pipeline.http           drive the pipeline by hand, no voice call
render.yaml                        Render blueprint
.env.example                       every variable, with a note on each
```

There is no `vercel.json`. A stock Next.js app needs none, and adding one would
only be something else to get wrong.

## Setup, about 15 minutes

### 1. Retell account and credit

Sign up at retellai.com. New accounts get 10 dollars of free credit, which is
roughly two hours of calls at the default voice, so it comfortably covers a
demo and the rehearsals.

On the API Keys page copy two things:

- the API key, which goes in `RETELL_API_KEY`
- the public key, which goes in `NEXT_PUBLIC_RETELL_PUBLIC_KEY`

The API key is also the HMAC secret used to sign webhooks. The key in your
environment has to be the same key that created the agent, or every webhook is
rejected with an invalid signature.

### 2. Pick a voice and fill in the placeholders

Open `retell/demo-agent.json` and replace `<VOICE_ID>` with a voice id from the
Voices page in the dashboard. Pick something warm and unhurried. A voice that
sounds like a call centre robot undoes the whole demo in the first sentence.

Open `retell/demo-flow.json` and replace `<FRONT_DESK_E164>` with the number the
transfer node should dial, in E.164, for example `+15550142200`. If you have no
real front desk number to hand, leave the placeholder. The transfer will fail,
the flow falls through to the callback path, and the agent offers to have the
team call back. That is a perfectly good thing to show and nobody has to answer
a phone.

### 3. Push the flow and the agent

```
RETELL_API_KEY=key_... DEMO_HOST=your-demo-host.onrender.com \
  npx tsx retell/push-demo-config.ts
```

Add `--dry-run` first if you want to see what it would do. It creates the
conversation flow, then the agent that points at it, substitutes `<DEMO_HOST>`
into every tool URL and into the post call webhook URL, records both ids in
`retell/.demo-ids.json`, and prints the line to paste into your environment:

```
NEXT_PUBLIC_RETELL_AGENT_ID=agent_...
```

Run it again after any edit and it updates in place instead of creating a
second copy, because it reads the ids back out of `.demo-ids.json`. That file
is gitignored. If you lose it, find the ids in the dashboard and write it back
by hand, or you will end up with duplicates.

### 4. Buy a phone number and bind the agent

In the dashboard, Phone Numbers, buy a number. It costs about 2 dollars a
month and comes out of the free credit. Bind it to the demo agent on the
inbound side. Put the number in `NEXT_PUBLIC_DEMO_PHONE_NUMBER` in E.164 so the
demo page shows it and the room can dial it.

Check that the agent is published, not left as a draft. An unpublished draft
answers in the simulator but not on the phone.

### 5. Set the environment variables

Copy `.env.example` to `.env.local` and fill it in. Generate the salt once:

```
openssl rand -hex 32
```

`ALLOW_UNSIGNED_WEBHOOKS` stays `false`. The green signature step in the
compliance panel is one of the better moments in the demo, and it only appears
when the check actually runs.

## The site in front of the demo

The root is now the marketing site for the product (home with the recorded
call, how it works, pricing, integrations, handover rules, security, privacy,
terms, and Book a demo). The public demo moved to `/demo`. Book a demo
writes a lead, emails the sales inbox, auto-replies to the prospect and
schedules a three-step follow-up that stops when the lead is marked
contacted in the console. Email goes through SendGrid and stays in preview
mode until `SENDGRID_API_KEY` exists; the worker runs from Vercel Cron every five minutes with
`CRON_SECRET`. Every word of site and email copy lives in `lib/product.ts`.

## The product behind the demo

The public page at `/` is the demo. The product lives at `/app` (a
practice's own workspace, invite only) and `/admin` (our console: create a
customer, send the invitation, open their workspace). Every table carries
`tenant_id` and the Retell webhooks route each call to the workspace that
owns the agent. Setup for sign-in is in [docs/auth-setup.md](docs/auth-setup.md).

## Running locally, no external services

```
npm install
npm run seed
npm run dev
```

Open http://localhost:3000. With `DATABASE_URL` unset the app uses PGlite, an
embedded Postgres that runs inside the Node process and writes to `./.pgdata`.
No Docker, no database account, no network. The SQL is identical to the
Postgres path, so nothing behaves differently when you later point
`DATABASE_URL` at Neon.

Retell cannot reach `localhost`, so a local run gives you the console and the
`tests/demo-pipeline.http` path but not a real phone call. For a real call from
a local server, run a tunnel and pass the tunnel hostname as `DEMO_HOST` when
you push the config:

```
npx localtunnel --port 3000
RETELL_API_KEY=key_... DEMO_HOST=quiet-fox-42.loca.lt npx tsx retell/push-demo-config.ts
```

Remember to push again with the real host before the demo, or the agent will
still be calling your laptop.

## Deploying

### Vercel

```
npx vercel --prod
```

Set every variable from `.env.example` in Project Settings, Environment
Variables. No `vercel.json` is needed. Vercel is the better choice for a demo:
there is no cold start worth worrying about, and the serverless functions
answer inside Retell's 15 second tool timeout every time.

On Vercel the filesystem is ephemeral and not shared between invocations, so
PGlite is not a safe choice there. Set `DATABASE_URL` to a Neon database. The
free Neon tier is enough. Run `npm run seed` once against it.

### Render

Push the repo to GitHub, then in Render choose New, Blueprint, and point it at
`render.yaml`. It builds with `npm install && npm run build`, starts with
`npm run start`, and health checks `/api/config`. Fill in every variable marked
`sync: false` in the Render dashboard.

Render free instances spin down after about fifteen minutes of no traffic, and
the next request waits roughly fifty seconds for the container to boot. Retell
gives a tool call 15 seconds. A cold instance therefore fails the first tool
call of the call and the agent falls back to the queue message, which looks
like a broken product. Warm it before the demo, every time. If the demo matters
more than the 7 dollars, use a paid instance.

On Render, PGlite is workable because there is a real filesystem, but it is
wiped on every deploy and every spin down, so the demo resets itself. Set
`PGLITE_DIR=/tmp/pgdata`. If the data has to survive, set `DATABASE_URL`.

## Wiring the two webhook URLs into Retell

The push script writes both of these for you. Check them in the dashboard
before the demo, because a stale host is the most common reason a demo fails.

1. Tool endpoint. On each of the eight custom tools in the conversation flow:
   `https://<DEMO_HOST>/api/retell/tool`
2. Call lifecycle webhook. On the agent, the `webhook_url` field:
   `https://<DEMO_HOST>/api/retell/post-call`

Both verify `x-retell-signature` as HMAC SHA256 over the raw body plus the
timestamp, keyed with the Retell API key, inside a 5 minute window. Retell also
publishes a fixed egress IP, 100.20.5.228, but we verify the signature rather
than the IP because both Vercel and Render sit behind proxies that rewrite the
source address.

Confirm the endpoints answer from a browser. Both have a GET that returns a
small JSON object. If `signature_required` comes back `false`, you left
`ALLOW_UNSIGNED_WEBHOOKS=true` on and you should turn it off.

## Before the demo

Run through this every time, about ten minutes before you start.

1. Warm the instance. Open the demo URL and wait for the page to paint. On
   Render this is the difference between a working demo and a queued fallback.
2. Reset the demo. Click Reset in the console, or POST `/api/reset`. This wipes
   the calls, appointments, audit rows and consent rows and reseeds the
   fortnight, so the schedule looks busy but has openings.
3. Make one test call to the number yourself. Book something, let it complete,
   then reset again. This proves the number, the binding, the voice, the tool
   endpoint and the webhook in one go.
4. Check the phone number is still bound to the agent and the agent is
   published. A republish can leave the binding pointed at an older version.
5. Check the credit balance in the dashboard. A demo that runs out of credit
   mid call is an unpleasant way to find out.
6. Open `tests/demo-pipeline.http` in a second window, ready to go, in case the
   audio fails. Know where the Reset button is.

## The demo itself, about 3 minutes

Three scenes. Do not improvise a fourth. The refusal scene is the one that
sells it, so leave time for it.

### Scene 1, the reschedule, about 90 seconds

Dial the number on speaker. Follow this, roughly:

> Agent: Thanks for calling Riverside Family Dental. You're speaking with our
> automated assistant, and this call is recorded for quality. Say staff at any
> time to reach a person. How can I help?
>
> You: I need to move my cleaning.
>
> Agent: Sure. To find your record, may I have your full name and date of birth?
>
> You: Sarah Whitfield, April twelfth nineteen eighty six.

While it looks her up, point at the compliance panel. The signature step turns
green, then the patient match step, and the match is logged as a pseudonym
rather than a name. Say that out loud: the log knows which record was touched
without holding who it was.

Let it offer three times. Take the second one. When it reads the booking back,
point out what it says and what it does not: day, time, provider, office, and
nothing else. No procedure code, no fee, no chart.

Then it asks the text reminder question, word for word, with the rates and the
STOP language. Say yes. Point at the consent row appearing with a timestamp and
a script version. That row is what you produce when someone asks whether the
patient agreed.

### Scene 2, the refusal, about 60 seconds

Stay on the call and say:

> You: Actually, while I have you, my tooth has been hurting since Tuesday and
> I think I still owe you money from last time.

Two forbidden topics in one sentence: clinical and billing. The agent should
decline both, not answer either, and offer to connect you to the team. It will
not diagnose, it will not quote a balance, and it will not guess.

Let it attempt the transfer. Then point at the panel: the call is flagged for
review, and the post call analysis recorded
`phi_beyond_scheduling_mentioned: true`. The line to land is that the system
knows what it is not allowed to do and says so in writing afterwards.

### Scene 3, the redaction toggle, about 30 seconds

Hang up and flip the redaction toggle in the console. The transcript switches
between what the caller said and what is actually stored. The name, the date of
birth and the phone number disappear.

Explain the setting behind it: `data_storage_setting` is
`everything_except_pii` and retention is 30 days for this demo, 90 in the
production plan, both configurable. Then stop talking. That is the end.

## Troubleshooting

**Every tool call returns 401, or the panel shows a red signature step.**
The `RETELL_API_KEY` in the deployed environment is not the key that created the
agent. Copy it again from the dashboard, redeploy, and remember that a redeploy
is needed because the value is read at request time from the server
environment, not from your shell. Second most likely cause: the server clock is
off by more than 5 minutes, which puts the signature outside its window.

**Tool calls succeed locally but 401 in production.** You have
`ALLOW_UNSIGNED_WEBHOOKS=true` locally and not in production, which is the
correct configuration. The real problem is elsewhere, usually the key.

**No audio, or the call connects and then nothing is said.** For the browser
widget, check that `NEXT_PUBLIC_RETELL_PUBLIC_KEY` and
`NEXT_PUBLIC_RETELL_AGENT_ID` are both set, that the browser has microphone
permission, and that the page is served over HTTPS, because getUserMedia is
blocked on plain HTTP outside localhost. For the phone number, check that the
number is bound to the agent and that the agent is published. If it connects
and stays silent, the flow's `start_speaker` is probably not `agent`.

**First tool call of every call times out, then the agent says the team will
follow up.** Cold start. The Render instance spun down. Warm it and call again.
If it happens on a warm instance, the database is the likely cause: a Neon
instance that has scaled to zero takes several seconds on the first query.

**The agent offers a slot, then says it could not book it.** Slot conflict. The
slot was taken between `get_slots` and `book_appointment`, so `book_appointment`
returned `queued` and the flow took the queue path. In a demo this almost
always means two calls are in flight against the same seeded schedule, or that
you did not reset after a rehearsal. Reset the demo. If you need to show it on
purpose, run request 5 in `tests/demo-pipeline.http` twice and book the same
slot twice.

**The agent cannot find Sarah Whitfield.** The seed did not run, or the reset
wiped and did not reseed. POST `/api/reset`, then run request 4 in
`tests/demo-pipeline.http` and check that it returns `pat_001`. Also check the
date of birth is being heard as `1986-04-12`. The tool matches the date exactly.

**The agent invents an appointment time.** The model ignored the tool result.
Check `model_temperature` is `0` and that `tool_call_strict_mode` is `true` in
`retell/demo-flow.json`, then push again.

**Audio fails on the day.** Open `tests/demo-pipeline.http`, set
`ALLOW_UNSIGNED_WEBHOOKS=true`, and walk the room through the same story with
the requests. The panel fills in identically. Say plainly that you are driving
the pipeline directly because the audio is not cooperating, and carry on. It is
far better than fighting a phone line in front of a prospect.

## Known TODOs

- `execution_message_type`, `execution_message_description`, `max_retry` and
  `tool_call_strict_mode` are carried over from the production flow in
  `../retell/conversation-flow/inbound-reception.flow.json`. They were not
  visible in the Create Conversation Flow reference that was checked, so they
  may be rejected or silently dropped. If the push fails on a schema error,
  delete those four and push again.
- `get_slots` maps only `status` into a response variable. The path syntax for
  indexing into the returned `slots` array was not confirmed, so the flow has
  the model read the slot list out of the raw tool result instead. It works,
  but it is the least deterministic part of the flow.
- `retell/demo-agent.json` sets `signed_url_expiration_ms` to one hour. The
  documented default is 24 hours. Shorter is the safer choice for a demo but it
  has not been tested against a recording playback in the console.
- The transfer node has no real destination until `<FRONT_DESK_E164>` is
  filled in.
