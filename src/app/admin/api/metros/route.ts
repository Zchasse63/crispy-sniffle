import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

/** Create a metro (city). New metros start at the 'basic' tier. */
export async function POST(req: NextRequest) {
  const ctx = await requireStaffApi("admin");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;

  let body: { name?: string; state?: string; lat?: number | string; lng?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const state = (body.state ?? "").trim().toUpperCase();
  const lat = body.lat != null && body.lat !== "" ? Number(body.lat) : null;
  const lng = body.lng != null && body.lng !== "" ? Number(body.lng) : null;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!state) return NextResponse.json({ error: "State is required" }, { status: 400 });
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Valid center coordinates are required" }, { status: 400 });
  }

  let slug = slugify(name) || "metro";
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await service.from("cities").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${slugify(name)}-${i}`;
  }

  const { data: created, error } = await service
    .from("cities")
    .insert({ name, state, slug, lat, lng, tier: "basic" })
    .select("id, slug")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(service, staff.userId, "metro.create", "cities", created.id, { name, state, slug: created.slug });
  return NextResponse.json({ ok: true, id: created.id, slug: created.slug });
}
