import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type {
  AmenityKey,
  City,
  EnrichedGym,
  GymAmenityRecord,
  GymEquipmentRecord,
  HoursMap,
  ProvenanceSource,
} from "@/lib/types/scout";

type Client = SupabaseClient<Database>;
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
type GymAmenityRow = Database["public"]["Tables"]["gym_amenities"]["Row"];
type GymEquipmentRow = Database["public"]["Tables"]["gym_equipment"]["Row"];

function toHoursMap(hours: GymRow["hours"]): HoursMap | null {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  return hours as HoursMap;
}

function assembleGym(
  row: GymRow,
  amenityRows: GymAmenityRow[],
  equipmentRows: GymEquipmentRow[],
): EnrichedGym {
  const hours = toHoursMap(row.hours);
  const amenities: GymAmenityRecord[] = amenityRows.map((a) => ({
    amenity_key: a.amenity_key as AmenityKey,
    present: a.present,
    source: a.source as ProvenanceSource,
    confidence: a.confidence,
    detail: a.detail,
  }));
  const open24hAmenity = amenities.find(
    (a) => a.amenity_key === "open_24h" && a.present,
  );
  return {
    id: row.id,
    slug: row.slug,
    city_id: row.city_id,
    name: row.name,
    neighborhood: row.neighborhood,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    description: row.description,
    segment: row.segment,
    day_pass_price: row.day_pass_price,
    week_pass_price: row.week_pass_price,
    hours,
    open_24h: Boolean(hours?.open_24h) || Boolean(open24hAmenity),
    website: row.website,
    phone: row.phone,
    photo_url: row.photo_url,
    rating: row.rating,
    rating_count: row.rating_count,
    verified: row.verified,
    amenities,
    equipment: equipmentRows.map(
      (e): GymEquipmentRecord => ({
        equipment_key: e.equipment_key,
        brand: e.brand,
        quantity: e.quantity,
        max_weight_lbs: e.max_weight_lbs,
        source: e.source as ProvenanceSource,
        confidence: e.confidence,
        detail: e.detail,
      }),
    ),
  };
}

async function joinGyms(client: Client, rows: GymRow[]): Promise<EnrichedGym[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((g) => g.id);
  const [amenitiesRes, equipmentRes] = await Promise.all([
    client.from("gym_amenities").select("*").in("gym_id", ids),
    client.from("gym_equipment").select("*").in("gym_id", ids),
  ]);
  if (amenitiesRes.error) throw amenitiesRes.error;
  if (equipmentRes.error) throw equipmentRes.error;

  const amenitiesByGym = new Map<string, GymAmenityRow[]>();
  for (const a of amenitiesRes.data) {
    const list = amenitiesByGym.get(a.gym_id) ?? [];
    list.push(a);
    amenitiesByGym.set(a.gym_id, list);
  }
  const equipmentByGym = new Map<string, GymEquipmentRow[]>();
  for (const e of equipmentRes.data) {
    const list = equipmentByGym.get(e.gym_id) ?? [];
    list.push(e);
    equipmentByGym.set(e.gym_id, list);
  }

  return rows.map((row) =>
    assembleGym(row, amenitiesByGym.get(row.id) ?? [], equipmentByGym.get(row.id) ?? []),
  );
}

export async function fetchCity(client: Client, slug: string): Promise<City | null> {
  const { data, error } = await client
    .from("cities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? ({ ...data, tier: data.tier as City["tier"] }) : null;
}

export async function fetchCities(client: Client): Promise<City[]> {
  const { data, error } = await client.from("cities").select("*").order("name");
  if (error) throw error;
  return data.map((c) => ({ ...c, tier: c.tier as City["tier"] }));
}

export async function fetchCityGyms(
  client: Client,
  citySlug: string,
): Promise<{ city: City | null; gyms: EnrichedGym[] }> {
  const city = await fetchCity(client, citySlug);
  if (!city) return { city: null, gyms: [] };
  const { data, error } = await client
    .from("gyms")
    .select("*")
    .eq("city_id", city.id)
    .order("rating", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return { city, gyms: await joinGyms(client, data) };
}

export async function fetchGymBySlug(
  client: Client,
  slug: string,
): Promise<EnrichedGym | null> {
  const { data, error } = await client
    .from("gyms")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [gym] = await joinGyms(client, [data]);
  return gym ?? null;
}

export async function fetchGymsByIds(
  client: Client,
  ids: string[],
): Promise<EnrichedGym[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client.from("gyms").select("*").in("id", ids);
  if (error) throw error;
  // Preserve caller's order (shortlist order)
  const joined = await joinGyms(client, data);
  const byId = new Map(joined.map((g) => [g.id, g]));
  return ids.map((id) => byId.get(id)).filter((g): g is EnrichedGym => Boolean(g));
}
