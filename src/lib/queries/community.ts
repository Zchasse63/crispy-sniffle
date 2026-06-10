import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export type CommunityLink = Database["public"]["Tables"]["community_links"]["Row"];
export type GymReview = Database["public"]["Tables"]["gym_reviews"]["Row"];
export type GymVisit = Database["public"]["Tables"]["gym_visits"]["Row"];

export async function fetchCommunityLinks(client: Client, gymSlug: string): Promise<CommunityLink[]> {
  const { data, error } = await client
    .from("community_links")
    .select("*")
    .eq("gym_slug", gymSlug)
    .order("year", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchGymReviews(client: Client, gymId: string): Promise<GymReview[]> {
  const { data, error } = await client
    .from("gym_reviews")
    .select("*")
    .eq("gym_id", gymId)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyVisits(client: Client, userId: string): Promise<GymVisit[]> {
  const { data, error } = await client
    .from("gym_visits")
    .select("*")
    .eq("user_id", userId)
    .order("visited_on", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}
