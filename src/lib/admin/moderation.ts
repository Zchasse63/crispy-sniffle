import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export interface ModerationStats {
  totalReviews: number;
  reportedReviews: number;
  hiddenReviews: number;
  bannedUsers: number;
  last7Days: number;
}

async function count(
  fn: () => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await fn();
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getModerationStats(client: Client): Promise<ModerationStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [totalReviews, reportedReviews, hiddenReviews, bannedUsers, last7Days] = await Promise.all([
    count(() => client.from("gym_reviews").select("*", { count: "exact", head: true })),
    count(() => client.from("gym_reviews").select("*", { count: "exact", head: true }).gte("report_count", 1)),
    count(() => client.from("gym_reviews").select("*", { count: "exact", head: true }).eq("hidden", true)),
    count(() => client.from("user_moderation").select("*", { count: "exact", head: true }).eq("status", "banned")),
    count(() => client.from("gym_reviews").select("*", { count: "exact", head: true }).gte("created_at", weekAgo)),
  ]);
  return { totalReviews, reportedReviews, hiddenReviews, bannedUsers, last7Days };
}

export interface ReviewRow {
  id: string;
  gymId: string;
  gymName: string | null;
  userId: string;
  rating: number;
  comment: string | null;
  hidden: boolean;
  reportCount: number;
  moderationReason: string | null;
  createdAt: string;
}

export type ReviewFilter = "reported" | "hidden" | "all";

export async function listReviews(client: Client, filter: ReviewFilter): Promise<ReviewRow[]> {
  let q = client
    .from("gym_reviews")
    .select("id, gym_id, user_id, rating, comment, hidden, report_count, moderation_reason, created_at")
    .order("report_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter === "reported") q = q.gte("report_count", 1);
  else if (filter === "hidden") q = q.eq("hidden", true);

  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const gymIds = [...new Set(rows.map((r) => r.gym_id))];
  const names = new Map<string, string>();
  if (gymIds.length) {
    const { data: gyms } = await client.from("gyms").select("id, name").in("id", gymIds);
    for (const g of gyms ?? []) names.set(g.id, g.name);
  }
  return rows.map((r) => ({
    id: r.id,
    gymId: r.gym_id,
    gymName: names.get(r.gym_id) ?? null,
    userId: r.user_id,
    rating: Number(r.rating),
    comment: r.comment,
    hidden: r.hidden,
    reportCount: r.report_count,
    moderationReason: r.moderation_reason,
    createdAt: r.created_at,
  }));
}

export interface CorrectionRow {
  id: string;
  gymId: string;
  gymName: string | null;
  factType: string;
  factKey: string;
  correctedValue: string | null;
  note: string | null;
  userId: string;
  updatedAt: string;
}

/**
 * Member-suggested corrections (fact_confirmations.verdict = 'correct'),
 * newest first. fact_confirmations RLS scopes `for all` rows to
 * `auth.uid() = user_id`, so a staff session client only ever sees its OWN
 * rows here — callers MUST pass a service-role client (bypasses RLS) to see
 * every member's corrections, same as any other cross-user admin listing.
 */
export async function listCorrections(client: Client, limit = 200): Promise<CorrectionRow[]> {
  const { data, error } = await client
    .from("fact_confirmations")
    .select("id, gym_id, user_id, fact_type, fact_key, corrected_value, note, updated_at")
    .eq("verdict", "correct")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const gymIds = [...new Set(rows.map((r) => r.gym_id))];
  const names = new Map<string, string>();
  if (gymIds.length) {
    const { data: gyms } = await client.from("gyms").select("id, name").in("id", gymIds);
    for (const g of gyms ?? []) names.set(g.id, g.name);
  }
  return rows.map((r) => ({
    id: r.id,
    gymId: r.gym_id,
    gymName: names.get(r.gym_id) ?? null,
    factType: r.fact_type,
    factKey: r.fact_key,
    correctedValue: r.corrected_value,
    note: r.note,
    userId: r.user_id,
    updatedAt: r.updated_at,
  }));
}

export interface BannedUser {
  userId: string;
  reason: string | null;
  createdAt: string;
}

export async function listBannedUsers(client: Client): Promise<BannedUser[]> {
  const { data, error } = await client
    .from("user_moderation")
    .select("user_id, reason, created_at")
    .eq("status", "banned")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((u) => ({ userId: u.user_id, reason: u.reason, createdAt: u.created_at }));
}
