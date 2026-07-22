import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { gymPhotoUrl } from "@/lib/gymPhotoUrl";
import { paginateAll } from "@/lib/supabase/paginate";
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
// Gym rows are fetched with the city's timezone embedded (`cities(timezone)`) so
// every EnrichedGym carries the IANA zone its hours are evaluated in.
type GymRowWithTz = GymRow & { cities: { timezone: string } | null };
const GYM_SELECT = "*, cities(timezone)";

// Browse surfaces (/, /city/[slug]) only need card/scorer fields. Long-text and
// detail-only scalars stay null; parking stays slim (access + is_primary for
// GymCard "free parking" + map pin); transit is empty (detail-only).
// description/phone/website stay — completeness() drives unfiltered browse order.
const GYM_CARD_SELECT = [
  "id",
  "slug",
  "city_id",
  "name",
  "neighborhood",
  "address",
  "lat",
  "lng",
  "description",
  "segment",
  "day_pass_price",
  "week_pass_price",
  "hours",
  "website",
  "phone",
  "photo_url",
  "photo_storage_path",
  "rating",
  "rating_count",
  "verified",
  "owner_listed",
  "hours_verified_at",
  "day_pass_verified_at",
  "status",
  "rating_is_seed",
  "vibe_tags",
  "drop_in_policy",
  "drop_in_note",
  "monthly_from",
  "monthly_note",
  "guest_policy_model",
  "members_guest_note",
  "cities(timezone)",
].join(", ");

type GymAmenityRow = Database["public"]["Tables"]["gym_amenities"]["Row"];
type GymEquipmentRow = Database["public"]["Tables"]["gym_equipment"]["Row"];
type GymParkingRow = Database["public"]["Tables"]["gym_parking"]["Row"];
type GymTransitRow = Database["public"]["Tables"]["gym_transit"]["Row"];

function toHoursMap(hours: GymRow["hours"]): HoursMap | null {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  return hours as HoursMap;
}

function assembleGym(
  row: GymRowWithTz,
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
    detail: a.detail ?? null,
  }));
  // Tri-state open_24h (never-fabricate): TRUE from a positive hours flag or an
  // open_24h amenity; FALSE only when we have a positive signal it's NOT 24h
  // (a published day-schedule, or an explicit present=false amenity); otherwise
  // NULL (unknown) — so Compare renders "Unknown", not a fabricated "No".
  const open24hAmenity = amenities.find((a) => a.amenity_key === "open_24h");
  const open_24h: boolean | null =
    hours?.open_24h === true || open24hAmenity?.present === true
      ? true
      : hours !== null || open24hAmenity?.present === false
        ? false
        : null;
  return {
    timezone: row.cities?.timezone ?? "America/New_York",
    id: row.id,
    slug: row.slug,
    city_id: row.city_id,
    name: row.name,
    neighborhood: row.neighborhood,
    address: row.address,
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : null,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : null,
    description: row.description,
    segment: row.segment,
    // numeric(*) columns arrive as wire strings via PostgREST — coerce so
    // price caps, sorting, and rating display compare as numbers not strings
    day_pass_price: row.day_pass_price !== null && row.day_pass_price !== undefined
      ? Number(row.day_pass_price)
      : null,
    week_pass_price: row.week_pass_price !== null && row.week_pass_price !== undefined
      ? Number(row.week_pass_price)
      : null,
    hours,
    open_24h,
    website: row.website,
    phone: row.phone,
    instagram: row.instagram ?? null,
    // Serve the rehosted Storage copy when we have one, else the original source.
    photo_url: gymPhotoUrl(row.photo_storage_path, row.photo_url),
    photo_storage_path: row.photo_storage_path,
    rating: row.rating !== null ? Number(row.rating) : null,
    rating_count: row.rating_count,
    verified: row.verified,
    owner_listed: row.owner_listed,
    hours_verified_at: row.hours_verified_at,
    day_pass_verified_at: row.day_pass_verified_at,
    status: row.status,
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
        detail: e.detail ?? null,
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
        detail: t.detail ?? null,
      }),
    ),
    parking: parkingRows.map(
      (p): GymParkingRecord => ({
        id: p.id,
        gym_id: p.gym_id,
        kind: (p.kind ?? "lot") as ParkingKind,
        name: p.name ?? null,
        distance_m: p.distance_m ?? null,
        access: (p.access ?? null) as ParkingAccess,
        fee_detail: p.fee_detail ?? null,
        capacity: p.capacity ?? null,
        // numeric(9,6)/numeric(3,2) arrive as wire strings via PostgREST
        lat: p.lat != null ? Number(p.lat) : null,
        lng: p.lng != null ? Number(p.lng) : null,
        is_primary: p.is_primary ?? false,
        source: (p.source ?? "estimated") as ProvenanceSource,
        confidence: Number(p.confidence ?? 0),
        detail: p.detail ?? null,
      }),
    ),
  };
}

/** Slim gym row from GYM_CARD_SELECT — enough for scorer + GymCard + map pin. */
type GymCardRow = {
  id: string;
  slug: string;
  city_id: string;
  name: string;
  neighborhood: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  segment: GymRow["segment"];
  day_pass_price: number | string | null;
  week_pass_price: number | string | null;
  hours: GymRow["hours"];
  website: string | null;
  phone: string | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  rating: number | string | null;
  rating_count: number;
  verified: boolean;
  owner_listed: boolean;
  hours_verified_at: string | null;
  day_pass_verified_at: string | null;
  status: GymRow["status"];
  rating_is_seed: boolean;
  vibe_tags: string[] | null;
  drop_in_policy: string | null;
  drop_in_note: string | null;
  monthly_from: number | string | null;
  monthly_note: string | null;
  guest_policy_model: string | null;
  members_guest_note: string | null;
  cities: { timezone: string } | null;
};

function assembleCardGym(
  row: GymCardRow,
  amenityRows: GymAmenityRow[],
  equipmentRows: GymEquipmentRow[],
  parkingRows: GymParkingRow[],
): EnrichedGym {
  // Reuse full assembleGym by padding detail-only columns to null — keeps one
  // open_24h / photo / numeric-coercion path (CLAUDE.md rule 5).
  const padded = {
    ...row,
    instagram: null,
    enrollment_fee: null,
    annual_fee: null,
    annual_fee_label: null,
    single_class_price: null,
    class_packs: null,
    intro_offer: null,
    min_commitment_months: null,
    no_contract_option: null,
    early_termination: null,
    cancellation_notice_days: null,
    freeze_policy: null,
    membership_plans: null,
    student_discount: null,
    military_discount: null,
    senior_discount: null,
    corporate_discount: null,
    family_plans: null,
    app_required_entry: null,
    waitlist: null,
    pricing_notes: null,
  } as unknown as GymRowWithTz;
  return assembleGym(padded, amenityRows, equipmentRows, parkingRows, []);
}

// PostgREST encodes `.in(...)` as a query-string filter, so a city with hundreds
// of gyms produces a URL that exceeds the server's length limit and 400s. Chunk the
// id list so each request stays small (also keeps every response under the 1000-row
// cap). Chunks run in parallel; results are concatenated.
const IN_CHUNK = 50;
/** Exact-1000 response is a latent truncation signal (PostgREST default max). */
const CHUNK_ROW_CAP = 1000;

async function chunkedIn<T>(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
  const results = await Promise.all(chunks.map((chunk) => run(chunk)));
  const out: T[] = [];
  for (const r of results) {
    if (r.error) throw r.error;
    if (r.data) {
      // Latent: a full page from a 50-id window means child rows were truncated.
      // Warn and still return — throwing would break browse; fix is a tighter select
      // or per-gym pagination if this ever fires in prod.
      if (r.data.length === CHUNK_ROW_CAP) {
        console.warn(
          `[chunkedIn] response hit ${CHUNK_ROW_CAP}-row PostgREST cap — possible truncation`,
        );
      }
      out.push(...r.data);
    }
  }
  return out;
}

function groupByGymId<T extends { gym_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.gym_id) ?? [];
    list.push(r);
    map.set(r.gym_id, list);
  }
  return map;
}

async function joinGyms(client: Client, rows: GymRowWithTz[]): Promise<EnrichedGym[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((g) => g.id);
  const [amenitiesData, equipmentData, parkingData, transitData] = await Promise.all([
    chunkedIn<GymAmenityRow>(ids, (c) => client.from("gym_amenities").select("*").in("gym_id", c)),
    chunkedIn<GymEquipmentRow>(ids, (c) => client.from("gym_equipment").select("*").in("gym_id", c)),
    chunkedIn<GymParkingRow>(ids, (c) =>
      client
        .from("gym_parking")
        .select("*")
        .in("gym_id", c)
        .order("is_primary", { ascending: false })
        .order("distance_m", { ascending: true, nullsFirst: true }),
    ),
    chunkedIn<GymTransitRow>(ids, (c) => client.from("gym_transit").select("*").in("gym_id", c)),
  ]);

  const amenitiesByGym = groupByGymId(amenitiesData);
  const equipmentByGym = groupByGymId(equipmentData);
  const parkingByGym = groupByGymId(parkingData);
  const transitByGym = groupByGymId(transitData);

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

/** Browse join: amenities + equipment + slim parking; no transit query. */
async function joinGymCards(client: Client, rows: GymCardRow[]): Promise<EnrichedGym[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((g) => g.id);
  // Partial projections — cast through unknown; assembleGym null-fills missing cols.
  const amenitySel = "gym_id, amenity_key, present, source, confidence";
  const equipmentSel =
    "gym_id, equipment_key, brand, quantity, max_weight_lbs, source, confidence";
  // access + is_primary for GymCard "free parking" chip + map pin headline
  const parkingSel =
    "id, gym_id, kind, name, distance_m, access, fee_detail, is_primary, source, confidence";

  const [amenitiesData, equipmentData, parkingData] = await Promise.all([
    chunkedIn(ids, (c) => client.from("gym_amenities").select(amenitySel).in("gym_id", c)),
    chunkedIn(ids, (c) => client.from("gym_equipment").select(equipmentSel).in("gym_id", c)),
    chunkedIn(ids, (c) =>
      client
        .from("gym_parking")
        .select(parkingSel)
        .in("gym_id", c)
        .order("is_primary", { ascending: false })
        .order("distance_m", { ascending: true, nullsFirst: true }),
    ),
  ]);

  const amenitiesByGym = groupByGymId(amenitiesData as GymAmenityRow[]);
  const equipmentByGym = groupByGymId(equipmentData as GymEquipmentRow[]);
  const parkingByGym = groupByGymId(parkingData as GymParkingRow[]);

  return rows.map((row) =>
    assembleCardGym(
      row,
      amenitiesByGym.get(row.id) ?? [],
      equipmentByGym.get(row.id) ?? [],
      parkingByGym.get(row.id) ?? [],
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
  // numeric(9,6) columns arrive as wire strings via PostgREST — coerce so
  // downstream distance math (haversineMiles, MapView center) gets numbers,
  // not strings that silently no-op in arithmetic.
  return data
    ? { ...data, tier: data.tier as City["tier"], lat: Number(data.lat), lng: Number(data.lng) }
    : null;
}

export async function fetchCities(client: Client): Promise<City[]> {
  const { data, error } = await client.from("cities").select("*").order("name");
  if (error) throw error;
  return data.map((c) => ({
    ...c,
    tier: c.tier as City["tier"],
    lat: Number(c.lat),
    lng: Number(c.lng),
  }));
}

// PostgREST caps a single response at 1000 rows. Page through .range() with a
// stable order (rating desc nulls last, then id) so the full set is fetched.
// NB: this fixes correctness (completeness) — the scorer still ranks the full
// set client-side. Shrinking the payload is fetchCityGymCards (browse only).
async function loadCityGymRows(client: Client, cityId: string): Promise<GymRowWithTz[]> {
  return paginateAll<GymRowWithTz>((from, to) =>
    client
      .from("gyms")
      .select(GYM_SELECT)
      .eq("city_id", cityId)
      // Public discovery hides closed / relocated / deduped listings.
      .not("status", "in", "(closed,moved,duplicate)")
      .order("rating", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to) as PromiseLike<{ data: GymRowWithTz[] | null; error: unknown }>,
  );
}

async function loadCityGymCardRows(client: Client, cityId: string): Promise<GymCardRow[]> {
  return paginateAll<GymCardRow>((from, to) =>
    client
      .from("gyms")
      .select(GYM_CARD_SELECT)
      .eq("city_id", cityId)
      .not("status", "in", "(closed,moved,duplicate)")
      .order("rating", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to) as PromiseLike<{ data: GymCardRow[] | null; error: unknown }>,
  );
}

export async function fetchCityGyms(
  client: Client,
  citySlug: string,
): Promise<{ city: City | null; gyms: EnrichedGym[] }> {
  const city = await fetchCity(client, citySlug);
  if (!city) return { city: null, gyms: [] };
  const rows = await loadCityGymRows(client, city.id);
  return { city, gyms: await joinGyms(client, rows) };
}

/**
 * Browse DTO for `/` and `/city/[slug]`. Same EnrichedGym type; detail-only
 * scalars null, transit empty, parking slim. Skips transit join entirely.
 */
export async function fetchCityGymCards(
  client: Client,
  citySlug: string,
): Promise<{ city: City | null; gyms: EnrichedGym[] }> {
  const city = await fetchCity(client, citySlug);
  if (!city) return { city: null, gyms: [] };
  const rows = await loadCityGymCardRows(client, city.id);
  const gyms = await joinGymCards(client, rows);
  if (process.env.NODE_ENV === "development") {
    const bytes = Buffer.byteLength(JSON.stringify(gyms), "utf8");
    console.info(`[fetchCityGymCards] ${city.slug}: ${gyms.length} gyms, ${bytes} bytes`);
  }
  return { city, gyms };
}

/** Same-city same-segment neighbors for the detail "similar spots" rail. */
export async function fetchSimilarGyms(
  client: Client,
  gym: Pick<EnrichedGym, "id" | "city_id" | "segment">,
  limit = 5,
): Promise<EnrichedGym[]> {
  if (!gym.segment) return [];
  const { data, error } = await client
    .from("gyms")
    .select(GYM_SELECT)
    .eq("city_id", gym.city_id)
    .eq("segment", gym.segment)
    .neq("id", gym.id)
    .not("status", "in", "(closed,moved,duplicate)")
    .order("rating", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return joinGyms(client, (data ?? []) as unknown as GymRowWithTz[]);
}

/** Slim city projection for computePriceBands — segment + day_pass only. */
export async function fetchCityPriceFields(
  client: Client,
  cityId: string,
): Promise<{ id: string; segment: EnrichedGym["segment"]; day_pass_price: number | null }[]> {
  const rows = await paginateAll<{
    id: string;
    segment: string | null;
    day_pass_price: number | string | null;
  }>((from, to) =>
    client
      .from("gyms")
      .select("id, segment, day_pass_price")
      .eq("city_id", cityId)
      .not("status", "in", "(closed,moved,duplicate)")
      .order("id", { ascending: true })
      .range(from, to) as PromiseLike<{
      data: { id: string; segment: string | null; day_pass_price: number | string | null }[] | null;
      error: unknown;
    }>,
  );
  return rows.map((r) => ({
    id: r.id,
    segment: r.segment as EnrichedGym["segment"],
    day_pass_price: r.day_pass_price !== null ? Number(r.day_pass_price) : null,
  }));
}

export async function fetchGymBySlug(
  client: Client,
  slug: string,
): Promise<EnrichedGym | null> {
  const { data, error } = await client
    .from("gyms")
    .select(GYM_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [gym] = await joinGyms(client, [data as unknown as GymRowWithTz]);
  return gym ?? null;
}

export async function fetchGymsByIds(
  client: Client,
  ids: string[],
): Promise<EnrichedGym[]> {
  if (ids.length === 0) return [];
  const data = await chunkedIn<GymRowWithTz>(ids, (c) =>
    client.from("gyms").select(GYM_SELECT).in("id", c) as PromiseLike<{
      data: GymRowWithTz[] | null;
      error: unknown;
    }>,
  );
  // Preserve caller's order (shortlist order)
  const joined = await joinGyms(client, data);
  const byId = new Map(joined.map((g) => [g.id, g]));
  return ids.map((id) => byId.get(id)).filter((g): g is EnrichedGym => Boolean(g));
}

/**
 * Slug-keyed counterpart to fetchGymsByIds — powers the shareable ?gyms=
 * slug list on /compare. Order-preserving (caller's slug order, e.g. the
 * URL) and silently drops slugs that don't resolve to a real row (renamed/
 * deleted gym in a stale shared link) rather than fabricating a placeholder.
 */
export async function fetchGymsBySlugs(
  client: Client,
  slugs: string[],
): Promise<EnrichedGym[]> {
  if (slugs.length === 0) return [];
  const data = await chunkedIn<GymRowWithTz>(slugs, (c) =>
    client.from("gyms").select(GYM_SELECT).in("slug", c) as PromiseLike<{
      data: GymRowWithTz[] | null;
      error: unknown;
    }>,
  );
  const joined = await joinGyms(client, data);
  const bySlug = new Map(joined.map((g) => [g.slug, g]));
  return slugs.map((slug) => bySlug.get(slug)).filter((g): g is EnrichedGym => Boolean(g));
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
    .select("id, url, subject, storage_path")
    .eq("gym_id", gymId)
    .limit(8);
  if (error) throw error;
  // Serve the rehosted Storage copy when present, else the original source url.
  return (data ?? []).map((p) => ({
    id: p.id,
    subject: p.subject,
    url: gymPhotoUrl(p.storage_path, p.url) ?? p.url,
  }));
}
