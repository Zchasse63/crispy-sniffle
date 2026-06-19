import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit, logGymEdits } from "@/lib/admin/api";
import { Constants } from "@/lib/types/database";

const SEGMENTS = new Set<string>(Constants.public.Enums.gym_segment);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/** Best-effort US geocode via the Census one-line geocoder (same source the
 *  loaders use). Returns null on any failure — never blocks gym creation. */
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" +
      encodeURIComponent(address);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const match = json?.result?.addressMatches?.[0]?.coordinates;
    if (!match) return null;
    const lat = Number(match.y);
    const lng = Number(match.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireStaffApi("admin");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;

  let body: {
    name?: string;
    city_id?: string;
    address?: string;
    segment?: string;
    website?: string;
    phone?: string;
    lat?: number | string;
    lng?: number | string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const cityId = (body.city_id ?? "").trim();
  const segment = body.segment?.trim() || null;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!cityId) return NextResponse.json({ error: "Metro is required" }, { status: 400 });
  if (segment !== null && !SEGMENTS.has(segment)) {
    return NextResponse.json({ error: "Invalid segment" }, { status: 400 });
  }

  const { data: city, error: cityErr } = await service
    .from("cities")
    .select("id")
    .eq("id", cityId)
    .maybeSingle();
  if (cityErr) return NextResponse.json({ error: cityErr.message }, { status: 500 });
  if (!city) return NextResponse.json({ error: "Metro not found" }, { status: 400 });

  // unique slug
  const base = slugify(name) || "gym";
  let slug = base;
  let unique = false;
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await service.from("gyms").select("id").eq("slug", slug).maybeSingle();
    if (!clash) {
      unique = true;
      break;
    }
    slug = `${base}-${i}`;
  }
  if (!unique) {
    const { data: clash } = await service.from("gyms").select("id").eq("slug", slug).maybeSingle();
    if (clash) return NextResponse.json({ error: "Could not generate a unique slug" }, { status: 409 });
  }

  // coords: explicit wins, else best-effort geocode from address
  let lat: number | null = body.lat != null && body.lat !== "" ? Number(body.lat) : null;
  let lng: number | null = body.lng != null && body.lng !== "" ? Number(body.lng) : null;
  if ((lat === null || lng === null) && body.address) {
    const geo = await geocode(body.address);
    if (geo) {
      lat = lat ?? geo.lat;
      lng = lng ?? geo.lng;
    }
  }
  if (lat !== null && !Number.isFinite(lat)) lat = null;
  if (lng !== null && !Number.isFinite(lng)) lng = null;

  const { data: created, error: insErr } = await service
    .from("gyms")
    .insert({
      name,
      slug,
      city_id: cityId,
      address: body.address?.trim() || null,
      segment: (segment as never) ?? null,
      website: body.website?.trim() || null,
      phone: body.phone?.trim() || null,
      lat,
      lng,
      status: "unverified_new",
      verified: false,
      rating_count: 0,
      rating_is_seed: true,
    })
    .select("id, slug")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await logGymEdits(service, [
    { gym_id: created.id, actor: staff.userId, action: "create", field: "name", new_value: name, source: "scout_verified" },
  ]);
  await logAudit(service, staff.userId, "gym.create", "gyms", created.id, { name, slug: created.slug, geocoded: lat !== null });

  return NextResponse.json({ ok: true, id: created.id, slug: created.slug });
}
