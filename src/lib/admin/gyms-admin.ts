import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { GymStatus, GymSegment } from "@/lib/types/scout";
import { completeness } from "@/lib/completeness";
import { paginateAll } from "@/lib/supabase/paginate";

type Client = SupabaseClient<Database>;
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];

function hasPriceSignal(row: Pick<GymRow, "monthly_from" | "day_pass_price" | "membership_plans">): boolean {
  return (
    row.monthly_from !== null ||
    row.day_pass_price !== null ||
    row.membership_plans !== null
  );
}

export interface AdminGymRow {
  id: string;
  slug: string;
  name: string;
  status: GymStatus;
  segment: GymSegment | null;
  verified: boolean;
  rating: number | null;
  ratingCount: number;
  monthlyFrom: number | null;
  dayPass: number | null;
  cityId: string;
  cityName: string | null;
  cityState: string | null;
  citySlug: string | null;
  completeness: number;
  hasPrice: boolean;
  updatedAt: string;
}

interface CityLite {
  id: string;
  name: string | null;
  state: string | null;
  slug: string | null;
}

async function fetchCityMap(client: Client): Promise<Map<string, CityLite>> {
  const { data, error } = await client.from("cities").select("id, name, state, slug");
  if (error) throw error;
  return new Map((data ?? []).map((c) => [c.id, c as CityLite]));
}

/** Master-table rows: every gym, all statuses, with city + completeness. */
export async function listGymsForAdmin(client: Client): Promise<AdminGymRow[]> {
  const [data, cityMap] = await Promise.all([
    paginateAll<GymRow>((from, to) =>
      client
        .from("gyms")
        .select("*")
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as PromiseLike<{ data: GymRow[] | null; error: unknown }>,
    ),
    fetchCityMap(client),
  ]);
  return data.map((row) => {
    const city = cityMap.get(row.city_id);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      segment: row.segment,
      verified: row.verified,
      rating: row.rating !== null ? Number(row.rating) : null,
      ratingCount: row.rating_count,
      monthlyFrom: row.monthly_from !== null ? Number(row.monthly_from) : null,
      dayPass: row.day_pass_price !== null ? Number(row.day_pass_price) : null,
      cityId: row.city_id,
      cityName: city?.name ?? null,
      cityState: city?.state ?? null,
      citySlug: city?.slug ?? null,
      completeness: completeness(row),
      hasPrice: hasPriceSignal(row),
      updatedAt: row.updated_at,
    };
  });
}

export interface DataQuality {
  totalGyms: number;
  provenanceMix: { source: string; count: number }[];
  lowConfidenceFacts: number;
  priceGapGyms: { id: string; slug: string; name: string; cityName: string | null }[];
  staleGyms: number;
  statusMix: { status: GymStatus; count: number }[];
  cityBoard: {
    cityId: string;
    name: string | null;
    state: string | null;
    gyms: number;
    avgCompleteness: number;
    priceGaps: number;
  }[];
}

type DataQualityRpc = {
  totalGyms: number;
  provenanceMix: { source: string; count: number }[];
  lowConfidenceFacts: number;
  priceGapGyms: { id: string; slug: string; name: string; cityName: string | null }[];
  staleGyms: number;
  statusMix: { status: string; count: number }[];
  cityBoard: {
    cityId: string;
    name: string | null;
    state: string | null;
    gyms: number;
    avgCompleteness: number;
    priceGaps: number;
  }[];
};

/** Data-quality cockpit aggregates via data_quality_stats() RPC (SQL-side). */
export async function getDataQuality(client: Client): Promise<DataQuality> {
  const { data, error } = await client.rpc("data_quality_stats");
  if (error) throw error;
  const raw = data as unknown as DataQualityRpc | null;
  if (!raw || typeof raw !== "object") {
    throw new Error("data_quality_stats returned empty payload");
  }
  return {
    totalGyms: Number(raw.totalGyms ?? 0),
    provenanceMix: Array.isArray(raw.provenanceMix) ? raw.provenanceMix : [],
    lowConfidenceFacts: Number(raw.lowConfidenceFacts ?? 0),
    priceGapGyms: Array.isArray(raw.priceGapGyms) ? raw.priceGapGyms : [],
    staleGyms: Number(raw.staleGyms ?? 0),
    statusMix: (Array.isArray(raw.statusMix) ? raw.statusMix : []).map((s) => ({
      status: s.status as GymStatus,
      count: Number(s.count),
    })),
    cityBoard: Array.isArray(raw.cityBoard) ? raw.cityBoard : [],
  };
}
