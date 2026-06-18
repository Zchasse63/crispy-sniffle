import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type {
  AmenityKey,
  City,
  DropInPolicy,
  EnrichedGym,
  GymAmenityRecord,
  GymEquipmentRecord,
  GymParkingRecord,
  GymTransitRecord,
  HoursMap,
  ParkingAccess,
  ParkingKind,
  ProvenanceSource,
} from "@/lib/types/scout";

type Client = SupabaseClient<Database>;
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
type GymAmenityRow = Database["public"]["Tables"]["gym_amenities"]["Row"];
type GymEquipmentRow = Database["public"]["Tables"]["gym_equipment"]["Row"];
type GymParkingRow = Database["public"]["Tables"]["gym_parking"]["Row"];
type GymTransitRow = Database["public"]["Tables"]["gym_transit"]["Row"];

function toHoursMap(hours: GymRow["hours"]): HoursMap | null {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  return hours as HoursMap;
}

function assembleGym(
  row: GymRow,
  amenityRows: GymAmenityRow[],
  equipmentRows: GymEquipmentRow[],
  parkingRows: GymParkingRow[],
  transitRows: GymTransitRow[],
): EnrichedGym {
  const hours = toHoursMap(row.hours);
  const amenities: GymAmenityRecord[] = amenityRows.map((a) => ({
    amenity_key: a.amenity_key as AmenityKey,
    present: a.present,
    source: a.source as ProvenanceSource,
    // numeric(3,2) arrives as a wire string via PostgREST — coerce or
    // confidence comparisons (badge thresholds, sorting) break silently
    confidence: Number(a.confidence),
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
    // numeric(*) columns arrive as wire strings via PostgREST — coerce so
    // price caps, sorting, and rating display compare as numbers not strings
    day_pass_price: row.day_pass_price !== null ? Number(row.day_pass_price) : null,
    week_pass_price: row.week_pass_price !== null ? Number(row.week_pass_price) : null,
    hours,
    open_24h: Boolean(hours?.open_24h) || Boolean(open24hAmenity),
    website: row.website,
    phone: row.phone,
    photo_url: row.photo_url,
    rating: row.rating !== null ? Number(row.rating) : null,
    rating_count: row.rating_count,
    verified: row.verified,
    rating_is_seed: row.rating_is_seed,
    vibe_tags: (row.vibe_tags ?? []) as EnrichedGym["vibe_tags"],
    drop_in_policy: (row.drop_in_policy as DropInPolicy | null) ?? null,
    drop_in_note: row.drop_in_note,
    monthly_from: row.monthly_from !== null ? Number(row.monthly_from) : null,
    monthly_note: row.monthly_note,
    // Pricing / membership / fees / access — numeric(*) columns coerce from
    // PostgREST wire strings; jsonb columns carry their typed shapes.
    enrollment_fee: row.enrollment_fee !== null ? Number(row.enrollment_fee) : null,
    annual_fee: row.annual_fee !== null ? Number(row.annual_fee) : null,
    annual_fee_label: row.annual_fee_label,
    single_class_price: row.single_class_price !== null ? Number(row.single_class_price) : null,
    class_packs: (row.class_packs as EnrichedGym["class_packs"]) ?? null,
    intro_offer: row.intro_offer,
    min_commitment_months: row.min_commitment_months,
    no_contract_option: row.no_contract_option,
    early_termination: (row.early_termination as EnrichedGym["early_termination"]) ?? null,
    cancellation_notice_days: row.cancellation_notice_days,
    freeze_policy: row.freeze_policy,
    membership_plans: (row.membership_plans as EnrichedGym["membership_plans"]) ?? null,
    student_discount: row.student_discount,
    military_discount: row.military_discount,
    senior_discount: row.senior_discount,
    corporate_discount: row.corporate_discount,
    family_plans: row.family_plans,
    guest_policy_model: (row.guest_policy_model as EnrichedGym["guest_policy_model"]) ?? null,
    app_required_entry: row.app_required_entry,
    waitlist: row.waitlist,
    members_guest_note: row.members_guest_note,
    pricing_notes: row.pricing_notes,
    amenities,
    equipment: equipmentRows.map(
      (e): GymEquipmentRecord => ({
        equipment_key: e.equipment_key,
        brand: e.brand,
        quantity: e.quantity,
        max_weight_lbs: e.max_weight_lbs,
        source: e.source as ProvenanceSource,
        confidence: Number(e.confidence),
        detail: e.detail,
      }),
    ),
    transit: transitRows.map(
      (t): GymTransitRecord => ({
        id: t.id,
        kind: t.kind as GymTransitRecord["kind"],
        name: t.name,
        distance_m: t.distance_m,
        source: t.source as ProvenanceSource,
        confidence: Number(t.confidence),
        detail: t.detail,
      }),
    ),
    parking: parkingRows.map(
      (p): GymParkingRecord => ({
        id: p.id,
        gym_id: p.gym_id,
        kind: p.kind as ParkingKind,
        name: p.name,
        distance_m: p.distance_m,
        access: p.access as ParkingAccess,
        fee_detail: p.fee_detail,
        capacity: p.capacity,
        // numeric(9,6)/numeric(3,2) arrive as wire strings via PostgREST
        lat: p.lat !== null ? Number(p.lat) : null,
        lng: p.lng !== null ? Number(p.lng) : null,
        is_primary: p.is_primary,
        source: p.source as ProvenanceSource,
        confidence: Number(p.confidence),
        detail: p.detail,
      }),
    ),
  };
}

async function joinGyms(client: Client, rows: GymRow[]): Promise<EnrichedGym[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((g) => g.id);
  const [amenitiesRes, equipmentRes, parkingRes, transitRes] = await Promise.all([
    client.from("gym_amenities").select("*").in("gym_id", ids),
    client.from("gym_equipment").select("*").in("gym_id", ids),
    client
      .from("gym_parking")
      .select("*")
      .in("gym_id", ids)
      .order("is_primary", { ascending: false })
      .order("distance_m", { ascending: true, nullsFirst: true }),
    client.from("gym_transit").select("*").in("gym_id", ids),
  ]);
  if (amenitiesRes.error) throw amenitiesRes.error;
  if (equipmentRes.error) throw equipmentRes.error;
  if (parkingRes.error) throw parkingRes.error;
  if (transitRes.error) throw transitRes.error;

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
  const parkingByGym = new Map<string, GymParkingRow[]>();
  for (const p of parkingRes.data) {
    const list = parkingByGym.get(p.gym_id) ?? [];
    list.push(p);
    parkingByGym.set(p.gym_id, list);
  }
  const transitByGym = new Map<string, GymTransitRow[]>();
  for (const t of transitRes.data) {
    const list = transitByGym.get(t.gym_id) ?? [];
    list.push(t);
    transitByGym.set(t.gym_id, list);
  }

  return rows.map((row) =>
    assembleGym(
      row,
      amenitiesByGym.get(row.id) ?? [],
      equipmentByGym.get(row.id) ?? [],
      parkingByGym.get(row.id) ?? [],
      transitByGym.get(row.id) ?? [],
    ),
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

export interface GymPhoto {
  id: string;
  url: string;
  subject: string | null;
}

/** Detail-page gallery (not part of EnrichedGym — list views don't need it). */
export async function fetchGymPhotos(client: Client, gymId: string): Promise<GymPhoto[]> {
  const { data, error } = await client
    .from("gym_photos")
    .select("id, url, subject")
    .eq("gym_id", gymId)
    .limit(8);
  if (error) throw error;
  return data ?? [];
}
