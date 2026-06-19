import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { GymStatus, GymSegment, ProvenanceSource } from "@/lib/types/scout";

type Client = SupabaseClient<Database>;
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];

/** Fields counted toward a gym's completeness score (name is always present). */
const CORE_FIELDS: (keyof GymRow)[] = [
  "address",
  "phone",
  "website",
  "segment",
  "description",
  "photo_url",
  "neighborhood",
  "hours",
  "monthly_from",
  "day_pass_price",
];

function completeness(row: GymRow): number {
  const present = CORE_FIELDS.filter((f) => {
    const v = row[f];
    return v !== null && v !== undefined && v !== "";
  }).length;
  return Math.round((present / CORE_FIELDS.length) * 100);
}

function hasPriceSignal(row: GymRow): boolean {
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
  const [{ data, error }, cityMap] = await Promise.all([
    client.from("gyms").select("*").order("name", { ascending: true }),
    fetchCityMap(client),
  ]);
  if (error) throw error;
  return (data ?? []).map((row) => {
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

const LOW_CONFIDENCE = 0.7;

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

/** Data-quality cockpit aggregates. Provenance/confidence come from the per-fact
 *  tables (gym_amenities + gym_equipment); the rest from the gym rows. */
export async function getDataQuality(client: Client): Promise<DataQuality> {
  const cityMap = await fetchCityMap(client);
  const [gymsRes, amenRes, equipRes] = await Promise.all([
    client.from("gyms").select("*"),
    client.from("gym_amenities").select("source, confidence"),
    client.from("gym_equipment").select("source, confidence"),
  ]);
  if (gymsRes.error) throw gymsRes.error;
  if (amenRes.error) throw amenRes.error;
  if (equipRes.error) throw equipRes.error;
  const gyms = gymsRes.data ?? [];

  // provenance + low-confidence across both fact tables
  const provCounts = new Map<string, number>();
  let lowConfidenceFacts = 0;
  for (const row of [...(amenRes.data ?? []), ...(equipRes.data ?? [])]) {
    const src = (row.source as ProvenanceSource | null) ?? "estimated";
    provCounts.set(src, (provCounts.get(src) ?? 0) + 1);
    if (Number(row.confidence) < LOW_CONFIDENCE) lowConfidenceFacts++;
  }

  // status mix
  const statusCounts = new Map<GymStatus, number>();
  for (const g of gyms) statusCounts.set(g.status, (statusCounts.get(g.status) ?? 0) + 1);

  // price gaps + staleness + city board
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  const priceGapGyms: DataQuality["priceGapGyms"] = [];
  let staleGyms = 0;
  const cityAgg = new Map<
    string,
    { gyms: number; completenessSum: number; priceGaps: number }
  >();
  for (const g of gyms) {
    const comp = completeness(g);
    const agg = cityAgg.get(g.city_id) ?? { gyms: 0, completenessSum: 0, priceGaps: 0 };
    agg.gyms++;
    agg.completenessSum += comp;
    if (!hasPriceSignal(g)) {
      agg.priceGaps++;
      priceGapGyms.push({
        id: g.id,
        slug: g.slug,
        name: g.name,
        cityName: cityMap.get(g.city_id)?.name ?? null,
      });
    }
    cityAgg.set(g.city_id, agg);
    const fetched = g.last_fetched_at ? new Date(g.last_fetched_at).getTime() : null;
    if (fetched === null || now - fetched > NINETY_DAYS) staleGyms++;
  }

  return {
    totalGyms: gyms.length,
    provenanceMix: [...provCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    lowConfidenceFacts,
    priceGapGyms: priceGapGyms.sort((a, b) => a.name.localeCompare(b.name)),
    staleGyms,
    statusMix: [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    cityBoard: [...cityAgg.entries()]
      .map(([cityId, v]) => ({
        cityId,
        name: cityMap.get(cityId)?.name ?? null,
        state: cityMap.get(cityId)?.state ?? null,
        gyms: v.gyms,
        avgCompleteness: Math.round(v.completenessSum / v.gyms),
        priceGaps: v.priceGaps,
      }))
      .sort((a, b) => b.gyms - a.gyms),
  };
}
