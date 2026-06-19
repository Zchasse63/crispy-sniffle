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
  staff: number | null;
  auditRecent: number | null;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // Service client: the dashboard is already behind the staff gate, and counting
  // via the session client would silently return 0 for any RLS-gated table.
  const client = getServiceClient() as unknown as Client;
  // Escape hatch for tables not yet in the generated types (land in later tasks).
  const untyped = client as unknown as SupabaseClient;

  const [gyms, cities, reviewsReported, reviewsHidden, submissionsPending, staff, auditRecent] =
    await Promise.all([
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
      safeCount(() => client.from("staff_members").select("*", { count: "exact", head: true })),
      safeCount(() => client.from("admin_audit_log").select("*", { count: "exact", head: true })),
    ]);

  return { gyms, cities, reviewsReported, reviewsHidden, submissionsPending, staff, auditRecent };
}
