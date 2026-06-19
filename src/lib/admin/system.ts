import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export interface AuditEntry {
  id: string;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  detail: unknown;
  actorEmail: string | null;
  createdAt: string;
}

/** Resolve a set of user ids to emails via the staff-only lookup RPC. */
async function resolveEmails(client: Client, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    [...new Set(ids)].map(async (uid) => {
      const { data } = await client.rpc("admin_user_lookup", { uid });
      if (data) map.set(uid, data as string);
    }),
  );
  return map;
}

export async function getAuditLog(client: Client, limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await client
    .from("admin_audit_log")
    .select("id, action, target_table, target_id, detail, actor, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const emails = await resolveEmails(client, rows.map((r) => r.actor).filter((a): a is string => !!a));
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetTable: r.target_table,
    targetId: r.target_id,
    detail: r.detail,
    actorEmail: r.actor ? (emails.get(r.actor) ?? null) : null,
    createdAt: r.created_at,
  }));
}

export interface StaffEntry {
  userId: string;
  role: string;
  email: string | null;
  createdAt: string;
}

export async function getStaffList(client: Client): Promise<StaffEntry[]> {
  const { data, error } = await client
    .from("staff_members")
    .select("user_id, role, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const emails = await resolveEmails(client, rows.map((r) => r.user_id));
  return rows.map((r) => ({
    userId: r.user_id,
    role: r.role,
    email: emails.get(r.user_id) ?? null,
    createdAt: r.created_at,
  }));
}

export interface ConfigEntry {
  key: string;
  value: unknown;
  updatedAt: string;
}

export async function getAppConfig(client: Client): Promise<ConfigEntry[]> {
  const { data, error } = await client.from("app_config").select("key, value, updated_at").order("key");
  if (error) throw error;
  return (data ?? []).map((r) => ({ key: r.key, value: r.value, updatedAt: r.updated_at }));
}
