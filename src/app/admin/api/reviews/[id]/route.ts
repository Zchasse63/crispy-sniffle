import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";

/** Moderate a single review: hide / restore / delete. Always refreshes the
 *  gym's aggregate rating so a hidden/deleted review stops polluting it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffApi("reviewer");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const { id } = await params;

  let body: { action?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action;
  if (!["hide", "restore", "delete"].includes(action ?? "")) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const { data: review, error: readErr } = await service
    .from("gym_reviews")
    .select("id, gym_id")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  if (action === "delete") {
    const { error } = await service.from("gym_reviews").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await service
      .from("gym_reviews")
      .update({
        hidden: action === "hide",
        moderated_by: staff.userId,
        moderated_at: new Date().toISOString(),
        moderation_reason: body.reason?.trim() || null,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recompute the gym's rating now that this review is hidden/removed/restored.
  const { error: rpcErr } = await service.rpc("refresh_gym_rating", { gym_uuid: review.gym_id });
  if (rpcErr) console.error("[moderation] refresh_gym_rating failed:", rpcErr.message);

  await logAudit(service, staff.userId, `review.${action}`, "gym_reviews", id, { gym_id: review.gym_id });
  return NextResponse.json({ ok: true });
}
