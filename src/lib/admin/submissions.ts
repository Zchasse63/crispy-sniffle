import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { ParsedFact } from "@/lib/owner/parse";

type Client = SupabaseClient<Database>;

export interface SubmissionRow {
  id: string;
  gymId: string;
  gymName: string | null;
  gymSlug: string | null;
  contactName: string | null;
  contactRole: string | null;
  status: string;
  factCount: number;
  conflictCount: number;
  createdAt: string;
}

async function gymNameMap(client: Client, gymIds: string[]) {
  if (gymIds.length === 0) return new Map<string, { name: string; slug: string }>();
  const { data } = await client.from("gyms").select("id, name, slug").in("id", gymIds);
  return new Map((data ?? []).map((g) => [g.id, { name: g.name, slug: g.slug }]));
}

/** Queue list — newest-conflicting first, then oldest pending. */
export async function listSubmissions(client: Client): Promise<SubmissionRow[]> {
  const { data, error } = await client
    .from("owner_submissions")
    .select("id, gym_id, contact_name, contact_role, status, fact_count, conflict_count, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = data ?? [];
  const names = await gymNameMap(client, [...new Set(rows.map((r) => r.gym_id))]);
  const mapped = rows.map((r) => ({
    id: r.id,
    gymId: r.gym_id,
    gymName: names.get(r.gym_id)?.name ?? null,
    gymSlug: names.get(r.gym_id)?.slug ?? null,
    contactName: r.contact_name,
    contactRole: r.contact_role,
    status: r.status,
    factCount: r.fact_count,
    conflictCount: r.conflict_count,
    createdAt: r.created_at,
  }));
  // pending first, then by conflicts desc, then oldest
  const rank = (s: string) => (s === "pending" ? 0 : s === "needs_info" ? 1 : 2);
  return mapped.sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      b.conflictCount - a.conflictCount ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export interface InviteRow {
  id: string;
  gymId: string;
  gymName: string | null;
  email: string | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  submissionId: string | null;
}

export async function listInvites(client: Client): Promise<InviteRow[]> {
  const { data, error } = await client
    .from("owner_invites")
    .select("id, gym_id, email, status, created_at, expires_at, used_at, submission_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = data ?? [];
  const names = await gymNameMap(client, [...new Set(rows.map((r) => r.gym_id))]);
  return rows.map((r) => ({
    id: r.id,
    gymId: r.gym_id,
    gymName: names.get(r.gym_id)?.name ?? null,
    email: r.email,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
    submissionId: r.submission_id,
  }));
}

export interface SubmissionDetail {
  id: string;
  gymId: string;
  gymName: string | null;
  gymSlug: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactRole: string | null;
  status: string;
  note: string | null;
  reviewNote: string | null;
  facts: ParsedFact[];
  createdAt: string;
}

export async function getSubmission(client: Client, id: string): Promise<SubmissionDetail | null> {
  const { data, error } = await client.from("owner_submissions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const names = await gymNameMap(client, [data.gym_id]);
  return {
    id: data.id,
    gymId: data.gym_id,
    gymName: names.get(data.gym_id)?.name ?? null,
    gymSlug: names.get(data.gym_id)?.slug ?? null,
    contactName: data.contact_name,
    contactEmail: data.contact_email,
    contactRole: data.contact_role,
    status: data.status,
    note: data.note,
    reviewNote: data.review_note,
    facts: (data.parsed_facts as unknown as ParsedFact[]) ?? [],
    createdAt: data.created_at,
  };
}
