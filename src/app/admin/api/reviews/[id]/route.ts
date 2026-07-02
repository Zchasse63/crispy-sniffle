import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";
import { hasMinRole } from "@/lib/admin/auth";

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
  // Hide/restore are reversible (reviewer). Permanent deletion is not — require
  // admin, matching the destructiveness of the action.
  if (action === "delete" && !hasMinRole(staff.role, "admin")) {
    return NextResponse.json({ error: "Only admins can permanently delete a review." }, { status: 403 });
  }

  const { data: review, error: readErr } = await service
    .from("gym_reviews")
    .select("id, gym_id")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  if (action === "delete") {
    // Remove the review's photo objects from the public bucket BEFORE deleting the
    // row (the review_photos rows cascade, but the storage objects would otherwise
    // stay publicly served at their URLs).
    const { data: photos } = await service
      .from("review_photos")
      .select("storage_path")
      .eq("review_id", id);
    const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
    if (paths.length > 0) {
      const { error: rmErr } = await service.storage.from("review-photos").remove(paths);
      // Abort before deleting the row: if we drop the row first and the storage
      // remove failed, review_photos cascades away and the public objects are
      // orphaned with no pointer. Failing here keeps the delete retryable.
      if (rmErr) {
        console.error("[moderation] removing review photos failed:", rmErr.message, paths);
        return NextResponse.json({ error: `removing review photos: ${rmErr.message}` }, { status: 500 });
      }
    }
    const { error } = await service.from("gym_reviews").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const restoring = action === "restore";
    const { error } = await service
      .from("gym_reviews")
      .update({
        hidden: action === "hide",
        // A moderator vouching for a review clears its accumulated reports so a
        // single fresh report can't immediately re-hide it (otherwise 3 prior
        // reports leave it one report away from auto-hiding again).
        ...(restoring ? { report_count: 0 } : {}),
        moderated_by: staff.userId,
        moderated_at: new Date().toISOString(),
        moderation_reason: body.reason?.trim() || null,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Clear the per-reporter ledger so re-hiding again needs a fresh 3 distinct
    // reporters, not just one more on top of the old brigade.
    if (restoring) {
      const { error: rrErr } = await service.from("review_reports").delete().eq("review_id", id);
      if (rrErr) console.error("[moderation] clearing review_reports failed:", rrErr.message);
    }
  }

  // Recompute the gym's rating now that this review is hidden/removed/restored.
  const { error: rpcErr } = await service.rpc("refresh_gym_rating", { gym_uuid: review.gym_id });
  if (rpcErr) console.error("[moderation] refresh_gym_rating failed:", rpcErr.message);

  // Surface an audit-write failure to the caller — this action (esp. delete) is
  // destructive and should never complete with no trace and a clean 200.
  const audited = await logAudit(service, staff.userId, `review.${action}`, "gym_reviews", id, {
    gym_id: review.gym_id,
  });
  return NextResponse.json({
    ok: true,
    ...(audited ? {} : { auditWarning: "Action applied but the audit-log write failed — see server logs." }),
  });
}
