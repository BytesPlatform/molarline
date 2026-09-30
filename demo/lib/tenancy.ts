/**
 * Tenancy: which customer a request belongs to, and the rule that no query
 * runs without knowing.
 *
 * The tenant travels in an AsyncLocalStorage context rather than as a
 * parameter on every function, so a tool handler three calls deep can still
 * write the right tenant_id without every signature between changing. A
 * query that runs outside any tenant context throws, on purpose: silently
 * reading another customer's rows is the one bug this product must never
 * ship.
 *
 * Copied and adapted across the three products. Keep the file name.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { q } from "./db";

export const DEMO_TENANT_ID = "demo";

export type TenantStatus = "invited" | "active" | "suspended";

export interface Tenant {
  id: string;
  name: string;
  short_name: string;
  tagline: string | null;
  main_number: string | null;
  timezone: string;
  plan: string;
  included_minutes: number;
  status: TenantStatus;
  retell_agent_id: string | null;
  phone_number: string | null;
  config: Record<string, unknown>;
  /** When trial access runs out. Null means no limit. */
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: number;
  tenant_id: string;
  email: string;
  name: string | null;
  role: "owner" | "staff";
  clerk_user_id: string | null;
  clerk_invitation_id: string | null;
  invite_status: "pending" | "sent" | "accepted" | "failed";
  invite_error: string | null;
  invited_at: string;
  accepted_at: string | null;
}

const storage = new AsyncLocalStorage<Tenant>();

/** Runs fn with every query inside scoped to the given tenant. */
export function withTenant<T>(tenant: Tenant, fn: () => Promise<T>): Promise<T> {
  return storage.run(tenant, fn);
}

/** The tenant of the current request. Throws outside a tenant context. */
export function tenant(): Tenant {
  const t = storage.getStore();
  if (!t) {
    throw new Error(
      "no tenant in scope: wrap this call in withTenant(). Every database access must know whose data it touches.",
    );
  }
  return t;
}

export function tenantId(): string {
  return tenant().id;
}

export function tenantInScope(): boolean {
  return Boolean(storage.getStore());
}

/* ------------------------------------------------------------------ rows */

const TENANT_COLUMNS = `id, name, short_name, tagline, main_number, timezone, plan, included_minutes,
  status, retell_agent_id, phone_number, config, trial_ends_at, created_at, updated_at`;

export async function getTenant(id: string): Promise<Tenant | null> {
  const rows = await q<Tenant>(`select ${TENANT_COLUMNS} from tenants where id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Maps a Retell agent to its tenant. The demo agent from the environment
 * always resolves to the demo tenant, so the public page keeps working even
 * on a database that was seeded before the tenants table existed.
 */
export async function tenantByAgentId(agentId: string | undefined | null): Promise<Tenant | null> {
  if (!agentId) return getTenant(DEMO_TENANT_ID);
  const rows = await q<Tenant>(`select ${TENANT_COLUMNS} from tenants where retell_agent_id = $1 limit 1`, [agentId]);
  if (rows[0]) return rows[0];
  if (agentId === process.env.NEXT_PUBLIC_RETELL_AGENT_ID) return getTenant(DEMO_TENANT_ID);
  return null;
}

export async function listTenants(): Promise<(Tenant & { members: number; calls_30d: number })[]> {
  return q(
    `select ${TENANT_COLUMNS},
            (select count(*)::int from memberships m where m.tenant_id = t.id) as members,
            (select count(*)::int from demo_calls c where c.tenant_id = t.id and c.started_at > now() - interval '30 days') as calls_30d
     from tenants t order by created_at desc`,
  );
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "tenant";
}

export async function createTenant(input: {
  name: string;
  shortName?: string;
  tagline?: string;
  mainNumber?: string;
  timezone?: string;
  plan?: string;
  includedMinutes?: number;
  retellAgentId?: string;
  phoneNumber?: string;
  /** How long the trial lasts. Omitted or 0 means access never expires. */
  trialDays?: number;
}): Promise<Tenant> {
  const base = slugify(input.name);
  let id = base;
  for (let n = 2; await getTenant(id); n++) id = `${base}-${n}`;

  const rows = await q<Tenant>(
    `insert into tenants (id, name, short_name, tagline, main_number, timezone, plan, included_minutes, retell_agent_id, phone_number, trial_ends_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     returning ${TENANT_COLUMNS}`,
    [
      id,
      input.name.trim(),
      (input.shortName || input.name.split(/\s+/)[0]).trim(),
      input.tagline?.trim() || null,
      input.mainNumber?.trim() || null,
      input.timezone || "America/Chicago",
      input.plan || "trial",
      input.includedMinutes ?? 0,
      input.retellAgentId?.trim() || null,
      input.phoneNumber?.trim() || null,
      input.trialDays && input.trialDays > 0 ? new Date(Date.now() + input.trialDays * 86_400_000).toISOString() : null,
    ],
  );
  return rows[0];
}

export async function updateTenant(
  id: string,
  patch: Partial<Pick<Tenant, "name" | "short_name" | "tagline" | "main_number" | "plan" | "included_minutes" | "status" | "retell_agent_id" | "phone_number" | "timezone" | "trial_ends_at">>,
): Promise<void> {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  await q(`update tenants set ${sets}, updated_at = now() where id = $1`, [id, ...keys.map((k) => patch[k] ?? null)]);
}

/**
 * Integration tokens for a tenant, sealed with lib/secretbox before they
 * touch the database. config.secrets holds only ciphertext.
 */
export async function setTenantSecret(id: string, name: string, value: string | null): Promise<void> {
  const { encryptSecret } = await import("./secretbox");
  const boxed = value === null ? null : encryptSecret(value);
  // jsonb_set never creates the intermediate object, so seed it first.
  await q(
    `update tenants set config = jsonb_set(
        case when coalesce(config, '{}'::jsonb) ? 'secrets' then config else coalesce(config, '{}'::jsonb) || '{"secrets":{}}'::jsonb end,
        array['secrets', $2], $3::jsonb, true),
        updated_at = now()
      where id = $1`,
    [id, name, JSON.stringify(boxed)],
  );
}

export async function getTenantSecret(t: Tenant, name: string): Promise<string | null> {
  const secrets = (t.config as { secrets?: Record<string, string | null> }).secrets ?? {};
  const boxed = secrets[name];
  if (!boxed) return null;
  const { decryptSecret } = await import("./secretbox");
  return decryptSecret(boxed);
}

/**
 * How much trial time is left. A tenant with no end date never expires,
 * which is what the demo tenant and our own workspaces use.
 */
export interface TrialState {
  limited: boolean;
  expired: boolean;
  /** Whole days remaining, rounded up. Zero on the last day. */
  daysLeft: number;
  endsAt: string | null;
}

export function trialState(t: Tenant): TrialState {
  if (!t.trial_ends_at) return { limited: false, expired: false, daysLeft: 0, endsAt: null };
  const ms = new Date(t.trial_ends_at).getTime() - Date.now();
  return {
    limited: true,
    expired: ms <= 0,
    daysLeft: Math.max(0, Math.ceil(ms / 86_400_000)),
    endsAt: t.trial_ends_at,
  };
}

/** Pushes the end date out from now, for "give them two more days". */
export async function extendTrial(id: string, days: number): Promise<void> {
  await q(`update tenants set trial_ends_at = now() + make_interval(days => $2), updated_at = now() where id = $1`, [id, days]);
}

/* ------------------------------------------------------------ memberships */

const MEMBER_COLUMNS = `id, tenant_id, email, name, role, clerk_user_id, clerk_invitation_id, invite_status, invite_error, invited_at, accepted_at`;

export async function listMemberships(tenantIdValue: string): Promise<Membership[]> {
  return q<Membership>(`select ${MEMBER_COLUMNS} from memberships where tenant_id = $1 order by id asc`, [tenantIdValue]);
}

export async function addMembership(input: {
  tenantId: string;
  email: string;
  name?: string;
  role?: "owner" | "staff";
}): Promise<Membership> {
  const rows = await q<Membership>(
    `insert into memberships (tenant_id, email, name, role)
     values ($1, lower($2), $3, $4)
     on conflict (tenant_id, email) do update set name = coalesce(excluded.name, memberships.name), role = excluded.role
     returning ${MEMBER_COLUMNS}`,
    [input.tenantId, input.email.trim(), input.name?.trim() || null, input.role ?? "owner"],
  );
  return rows[0];
}

export async function getMembership(id: number): Promise<Membership | null> {
  const rows = await q<Membership>(`select ${MEMBER_COLUMNS} from memberships where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function recordInvitation(
  id: number,
  result: { status: "sent"; invitationId: string } | { status: "failed"; error: string } | { status: "pending" },
): Promise<void> {
  if (result.status === "sent") {
    await q(
      `update memberships set invite_status = 'sent', clerk_invitation_id = $2, invite_error = null, invited_at = now() where id = $1`,
      [id, result.invitationId],
    );
  } else if (result.status === "failed") {
    await q(`update memberships set invite_status = 'failed', invite_error = $2 where id = $1`, [id, result.error]);
  } else {
    await q(`update memberships set invite_status = 'pending', invite_error = null where id = $1`, [id]);
  }
}

export async function removeMembership(id: number): Promise<void> {
  await q(`delete from memberships where id = $1`, [id]);
}

/**
 * The memberships a signed-in person holds. A row created by an invitation
 * has no Clerk id until the person signs in for the first time, so the
 * lookup falls back to the email and binds the id on the way through.
 */
export async function membershipsForUser(user: { id: string; email: string | null }): Promise<Membership[]> {
  const byId = await q<Membership>(
    `select ${MEMBER_COLUMNS} from memberships where clerk_user_id = $1 order by id asc`,
    [user.id],
  );
  if (byId.length || !user.email) return byId;

  const claimed = await q<Membership>(
    `update memberships
       set clerk_user_id = $1, invite_status = 'accepted', accepted_at = coalesce(accepted_at, now())
     where lower(email) = lower($2) and clerk_user_id is null
     returning ${MEMBER_COLUMNS}`,
    [user.id, user.email],
  );
  return claimed;
}
