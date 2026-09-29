/**
 * Demo database schema.
 *
 * The four compliance tables (phi_access_log, consent_events, booking_queue,
 * suppression_list) are the same shape as the production build in db/*.sql, so
 * what the client sees in the demo is what ships. The practice tables stand in
 * for Dentrix, which we cannot reach in a demo.
 *
 * Every table carries tenant_id. The demo tenant owns the public page; each
 * practice created from the admin console owns its own rows. See lib/tenancy.ts.
 *
 * Kept as a TypeScript string rather than a .sql file so it is bundled into
 * serverless functions without any file-system access at runtime. Every
 * statement is idempotent and the "alter table" lines migrate a database
 * created before tenancy in place.
 */

export const SCHEMA_SQL = `
-- ---------- tenancy ----------
-- One row per customer. The demo tenant is created at bootstrap and backs
-- the public page; every other row is created from the admin console.

create table if not exists tenants (
  id               text primary key,
  name             text not null,
  short_name       text not null,
  tagline          text,
  main_number      text,
  timezone         text not null default 'America/New_York',
  plan             text not null default 'trial',
  included_minutes integer not null default 0,
  status           text not null default 'invited',   -- invited, active, suspended
  retell_agent_id  text,
  phone_number     text,
  config           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists tenants_agent on tenants (retell_agent_id) where retell_agent_id is not null;

create table if not exists memberships (
  id                  bigserial primary key,
  tenant_id           text not null references tenants (id) on delete cascade,
  email               text not null,
  name                text,
  role                text not null default 'owner',     -- owner, staff
  clerk_user_id       text,
  clerk_invitation_id text,
  invite_status       text not null default 'pending',   -- pending, sent, accepted, failed
  invite_error        text,
  invited_at          timestamptz not null default now(),
  accepted_at         timestamptz,
  unique (tenant_id, email)
);
create index if not exists memberships_user on memberships (clerk_user_id);

-- ---------- stand-in for the practice management system ----------

create table if not exists demo_patients (
  id            text primary key,
  tenant_id        text not null default 'demo',
  first_name    text not null,
  last_name     text not null,
  date_of_birth date not null,
  phone         text not null,
  location_id   text not null
);

create table if not exists demo_appointments (
  id             text primary key,
  tenant_id        text not null default 'demo',
  patient_id     text references demo_patients(id),
  provider_id    text not null,
  operatory_id   text not null,
  location_id    text not null,
  type_id        text not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text not null default 'booked',   -- booked, cancelled, confirmed
  created_by     text not null default 'front_desk', -- front_desk or ai_agent
  call_id        text,
  created_at     timestamptz not null default now()
);
create index if not exists demo_appointments_starts_at on demo_appointments (starts_at);

-- ---------- compliance tables, same shape as production ----------

create table if not exists phi_access_log (
  id              bigserial primary key,
  tenant_id        text not null default 'demo',
  occurred_at     timestamptz not null default now(),
  actor           text not null,
  action          text not null,
  call_id         text,
  patient_ref     text,
  appointment_ref text,
  location        text,
  outcome         text not null,
  detail          jsonb
);
create index if not exists phi_access_log_occurred_at on phi_access_log (occurred_at);
create index if not exists phi_access_log_call_id on phi_access_log (call_id);

create table if not exists consent_events (
  id          bigserial primary key,
  tenant_id        text not null default 'demo',
  occurred_at timestamptz not null default now(),
  call_id     text not null,
  phone_hash  text not null,
  phone_last4 text not null,
  kind        text not null,
  script_ver  text not null,
  channel     text not null
);
create index if not exists consent_events_call_id on consent_events (call_id);

create table if not exists booking_queue (
  id           bigserial primary key,
  tenant_id        text not null default 'demo',
  created_at   timestamptz not null default now(),
  call_id      text not null,
  patient_ref  text,
  location     text not null,
  reason       text not null,
  requested    jsonb not null,
  fulfilled_at timestamptz,
  fulfilled_by text
);

create table if not exists suppression_list (
  tenant_id  text not null default 'demo',
  phone_hash text not null,
  added_at   timestamptz not null default now(),
  source     text not null,
  primary key (tenant_id, phone_hash)
);

-- ---------- demo-only: drives the live pipeline panel ----------

create table if not exists pipeline_events (
  id          bigserial primary key,
  tenant_id        text not null default 'demo',
  occurred_at timestamptz not null default now(),
  call_id     text not null,
  step        text not null,
  status      text not null,          -- running, ok, warn, error
  detail      text,
  duration_ms integer
);
create index if not exists pipeline_events_call_id on pipeline_events (call_id);

create table if not exists demo_calls (
  call_id     text primary key,
  tenant_id        text not null default 'demo',
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  channel     text not null default 'web',   -- web or phone
  outcome     text,
  flagged     boolean not null default false,
  summary     text,
  transcript  text,
  recording_url text
);

-- ---------- platform: prospects, email, jobs ----------
-- These belong to us, not to a tenant. A lead becomes a tenant when sales
-- closes it; the messages and jobs tables carry both the landing site's
-- emails and, later, each tenant's notifications.

create table if not exists leads (
  id                  bigserial primary key,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  source              text not null default 'book_demo',
  name                text not null,
  business            text,
  email               text not null,
  phone               text not null,
  message             text,
  consent_contact     boolean not null default false,
  consent_at          timestamptz,
  consent_text        text,
  status              text not null default 'new',        -- new, contacted, booked, converted, closed
  tenant_id           text references tenants (id) on delete set null,
  sequence_stopped_at timestamptz,
  notes               text,
  ip_hash             text,
  user_agent          text
);
create index if not exists leads_status on leads (status, created_at);

create table if not exists messages (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  tenant_id    text,
  lead_id      bigint,
  channel      text not null default 'email',              -- email, sms
  direction    text not null default 'outbound',
  to_address   text not null,
  from_address text,
  template     text not null,
  subject      text,
  body_text    text,
  status       text not null default 'queued',             -- preview, queued, sent, delivered, opened, clicked, bounced, spam, failed
  provider     text not null default 'preview',            -- preview, sendgrid, twilio
  provider_id  text,
  error        text,
  events       jsonb not null default '[]'::jsonb
);
create index if not exists messages_lead on messages (lead_id, id);
create index if not exists messages_tenant on messages (tenant_id, id);

create table if not exists jobs (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  run_at      timestamptz not null default now(),
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'queued',              -- queued, running, done, failed, cancelled
  attempts    integer not null default 0,
  last_error  text,
  finished_at timestamptz,
  lead_id     bigint,
  tenant_id   text
);
create index if not exists jobs_due on jobs (status, run_at);
create index if not exists jobs_lead on jobs (lead_id);

-- ---------- migration for databases created before tenancy ----------
alter table demo_patients add column if not exists tenant_id text not null default 'demo';
alter table demo_appointments add column if not exists tenant_id text not null default 'demo';
alter table phi_access_log add column if not exists tenant_id text not null default 'demo';
alter table consent_events add column if not exists tenant_id text not null default 'demo';
alter table booking_queue add column if not exists tenant_id text not null default 'demo';
alter table suppression_list add column if not exists tenant_id text not null default 'demo';
alter table pipeline_events add column if not exists tenant_id text not null default 'demo';
alter table demo_calls add column if not exists tenant_id text not null default 'demo';
alter table demo_calls add column if not exists transcript text;
alter table demo_calls add column if not exists recording_url text;
alter table demo_calls add column if not exists transcript text;
alter table demo_calls add column if not exists recording_url text;
do $$ begin
  -- The suppression list used to be keyed by phone hash alone. Re-key it per
  -- tenant so one office's opt-out never silences a caller at another.
  if exists (
    select 1 from pg_constraint
    where conname = 'suppression_list_pkey' and conrelid = 'suppression_list'::regclass
      and array_length(conkey, 1) = 1
  ) then
    alter table suppression_list drop constraint suppression_list_pkey;
    alter table suppression_list add primary key (tenant_id, phone_hash);
  end if;
end $$;
create index if not exists demo_patients_tenant on demo_patients (tenant_id, date_of_birth);
create index if not exists demo_appointments_tenant on demo_appointments (tenant_id, starts_at);
create index if not exists phi_access_log_tenant on phi_access_log (tenant_id, id);
create index if not exists consent_events_tenant on consent_events (tenant_id, id);
create index if not exists booking_queue_tenant on booking_queue (tenant_id, id);
create index if not exists pipeline_events_tenant on pipeline_events (tenant_id, id);
create index if not exists demo_calls_tenant on demo_calls (tenant_id, started_at);
`;

/** The tables that hold a tenant's data, in an order safe to clear. */
export const TENANT_TABLES = [
  "pipeline_events",
  "phi_access_log",
  "consent_events",
  "booking_queue",
  "suppression_list",
  "demo_calls",
  "demo_appointments",
  "demo_patients",
] as const;
