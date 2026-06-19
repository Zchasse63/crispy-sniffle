import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";

const TIERS = new Set(["basic", "rich"]);

/** Promote/demote a metro's tier (basic ↔ rich). Tier changes are operator-gated. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffApi("admin");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const { id } = await params;

  let body: { tier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tier = body.tier;
  if (!tier || !TIERS.has(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const { data: updated, error } = await service
    .from("cities")
    .update({ tier })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Metro not found" }, { status: 404 });

  await logAudit(service, staff.userId, "metro.tier", "cities", id, { tier });
  return NextResponse.json({ ok: true });
}
