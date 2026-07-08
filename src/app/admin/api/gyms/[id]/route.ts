import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit, logGymEdits, type GymEditEntry } from "@/lib/admin/api";
import { EDITABLE_GYM_FIELDS, type GymFieldType } from "@/lib/admin/gymFields";
import { Constants } from "@/lib/types/database";
import type { Database } from "@/lib/types/database";
import { DROP_IN_LABELS } from "@/lib/types/scout";

const SEGMENTS = new Set<string>(Constants.public.Enums.gym_segment);
const STATUSES = new Set<string>(Constants.public.Enums.gym_status);
const DROPINS = new Set<string>(Object.keys(DROP_IN_LABELS));

class BadValue extends Error {}

/** Coerce a raw JSON value into the column's type, or throw BadValue. Empty /
 *  null becomes SQL null ("Unlisted") — we never fabricate a 0/false. */
function coerce(type: GymFieldType, raw: unknown): string | number | boolean | null {
  if (raw === null || raw === undefined || raw === "") return null;
  switch (type) {
    case "number":
    case "currency": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) throw new BadValue("not a number");
      return n;
    }
    case "boolean": {
      if (raw === true || raw === "true") return true;
      if (raw === false || raw === "false") return false;
      throw new BadValue("not a boolean");
    }
    case "segment":
      if (!SEGMENTS.has(String(raw))) throw new BadValue("bad segment");
      return String(raw);
    case "status":
      if (!STATUSES.has(String(raw))) throw new BadValue("bad status");
      return String(raw);
    case "dropin":
      if (!DROPINS.has(String(raw))) throw new BadValue("bad drop-in policy");
      return String(raw);
    default:
      return String(raw).trim() || null;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Catalog edits require admin (reviewers are queue/moderation only).
  const ctx = await requireStaffApi("admin");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const { id } = await params;

  let body: { patch?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch = body.patch ?? {};
  if (typeof patch !== "object" || Array.isArray(patch)) {
    return NextResponse.json({ error: "patch must be an object" }, { status: 400 });
  }

  const { data: current, error: readErr } = await service
    .from("gyms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Gym not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  const edits: GymEditEntry[] = [];
  for (const [key, raw] of Object.entries(patch)) {
    const def = EDITABLE_GYM_FIELDS[key];
    if (!def) return NextResponse.json({ error: `Field not editable: ${key}` }, { status: 400 });
    let value: string | number | boolean | null;
    try {
      value = coerce(def.type, raw);
    } catch {
      return NextResponse.json({ error: `Bad value for ${key}` }, { status: 400 });
    }
    if (value === null && (def.required || def.twoState)) {
      return NextResponse.json({ error: `${def.label} cannot be empty` }, { status: 400 });
    }
    const prev = (current as Record<string, unknown>)[key] ?? null;
    // numeric columns arrive as wire strings — compare coerced
    const prevComparable =
      (def.type === "number" || def.type === "currency") && prev !== null ? Number(prev) : prev;
    if (value === prevComparable) continue; // no-op
    updates[key] = value;
    edits.push({
      gym_id: id,
      actor: staff.userId,
      action: key === "status" ? "status" : "update",
      field: key,
      old_value: prev,
      new_value: value,
      source: "scout_verified",
    });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, changed: 0 });
  }
  if ("status" in updates) updates.status_changed_at = new Date().toISOString();
  // A new hero url must invalidate the rehosted Storage copy, or gymPhotoUrl keeps
  // serving the stale image (it prefers storage_path). Cleared → rehost re-derives.
  if ("photo_url" in updates) updates.photo_storage_path = null;
  updates.updated_at = new Date().toISOString();

  const { error: upErr } = await service
    .from("gyms")
    .update(updates as Database["public"]["Tables"]["gyms"]["Update"])
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await logGymEdits(service, edits);
  await logAudit(service, staff.userId, "gym.update", "gyms", id, {
    fields: edits.map((e) => e.field),
  });

  return NextResponse.json({ ok: true, changed: edits.length });
}
