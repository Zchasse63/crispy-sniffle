import "server-only";
import { getServiceClient } from "@/lib/admin/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

/** A count query that returns null (rendered "—") when the table/filter isn't
 *  available yet or the query errors — never a misleading 0. */
async function safeCount(
  fn: () => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number | null> {
  try {
    const { count, error } = await fn();
    if (error) return null;
    // A real (even empty) table returns a numeric count; null means the table
    // is missing/unreadable — render "—", never a misleading 0.
    return count;
  } catch {
    return null;
  }
}

export interface DashboardMetrics {
  gyms: number | null;
  cities: number | null;
  reviewsReported: number | null;
  reviewsHidden: number | null;
  submissionsPending: number | null;
  /** Pending owner submissions where the owner's answer conflicts with the
   *  current catalog value (owner_submissions.conflict_count > 0) — the
   *  "fact correction" queue: a real, actionable subset of the owner queue. */
  submissionsConflicted: number | null;
  /** Gyms flagged status='suspect' — the cheap data-quality alert signal
   *  (distinct from /admin/data-quality's low-confidence-fact metric). */
  suspectGyms: number | null;
  staff: number | null;
  auditRecent: number | null;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // Service client: the dashboard is already behind the staff gate, and counting
  // via the session client would silently return 0 for any RLS-gated table.
  const client = getServiceClient() as unknown as Client;
  // Escape hatch for tables not yet in the generated types (land in later tasks).
  const untyped = client as unknown as SupabaseClient;

  const [
    gyms,
    cities,
    reviewsReported,
    reviewsHidden,
    submissionsPending,
    submissionsConflicted,
    suspectGyms,
    staff,
    auditRecent,
  ] = await Promise.all([
    safeCount(() => client.from("gyms").select("*", { count: "exact", head: true })),
    safeCount(() => client.from("cities").select("*", { count: "exact", head: true })),
    safeCount(() =>
      client.from("gym_reviews").select("*", { count: "exact", head: true }).gte("report_count", 1),
    ),
    safeCount(() =>
      client.from("gym_reviews").select("*", { count: "exact", head: true }).eq("hidden", true),
    ),
    safeCount(() =>
      untyped.from("owner_submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ),
    safeCount(() =>
      untyped
        .from("owner_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .gt("conflict_count", 0),
    ),
    safeCount(() => client.from("gyms").select("*", { count: "exact", head: true }).eq("status", "suspect")),
    safeCount(() => client.from("staff_members").select("*", { count: "exact", head: true })),
    safeCount(() => client.from("admin_audit_log").select("*", { count: "exact", head: true })),
  ]);

  return {
    gyms,
    cities,
    reviewsReported,
    reviewsHidden,
    submissionsPending,
    submissionsConflicted,
    suspectGyms,
    staff,
    auditRecent,
  };
}

export interface NavCounts {
  ownerQueuePending: number | null;
  moderationFlagged: number | null;
}

/** Cheap head-counts for the AdminNav sidebar badges. Deliberately a separate,
 *  narrower query set from getDashboardMetrics() — this runs from the admin
 *  layout on EVERY /admin/* navigation, so it must not pay for the full
 *  dashboard metrics query set (gyms/cities/staff/audit) on every page load. */
export async function getNavCounts(): Promise<NavCounts> {
  const client = getServiceClient() as unknown as Client;
  const untyped = client as unknown as SupabaseClient;

  const [ownerQueuePending, reviewsReported, reviewsHidden] = await Promise.all([
    safeCount(() =>
      untyped.from("owner_submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ),
    safeCount(() =>
      client.from("gym_reviews").select("*", { count: "exact", head: true }).gte("report_count", 1),
    ),
    safeCount(() => client.from("gym_reviews").select("*", { count: "exact", head: true }).eq("hidden", true)),
  ]);

  // Never fabricate a combined total from a partial failure — null propagates.
  const moderationFlagged =
    reviewsReported === null || reviewsHidden === null ? null : reviewsReported + reviewsHidden;

  return { ownerQueuePending, moderationFlagged };
}
