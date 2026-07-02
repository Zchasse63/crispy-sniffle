import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";

/** Ban or unban a user. Banning also hides their existing visible reviews and
 *  recomputes the affected gyms' ratings. is_banned() blocks future reviews. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffApi("admin");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const { id: userId } = await params;

  let body: { action?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "ban" && action !== "unban") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await service.from("user_moderation").upsert(
    {
      user_id: userId,
      status: action === "ban" ? "banned" : "active",
      reason: body.reason?.trim() || null,
      moderated_by: staff.userId,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  let hiddenCount = 0;
  let restoredCount = 0;
  if (action === "ban") {
    const { data: reviews, error: readErr } = await service
      .from("gym_reviews")
      .select("id, gym_id")
      .eq("user_id", userId)
      .eq("hidden", false);
    // A read failure here would silently skip hiding — don't report success.
    if (readErr) return NextResponse.json({ error: `reading reviews: ${readErr.message}` }, { status: 500 });
    if (reviews && reviews.length > 0) {
      const { error: hideErr } = await service
        .from("gym_reviews")
        .update({ hidden: true, moderated_by: staff.userId, moderated_at: now, moderation_reason: "user banned" })
        .eq("user_id", userId)
        .eq("hidden", false);
      // Don't claim success (or a hidden-count) if the hide actually failed —
      // the reviews would stay visible and still counted in gym ratings.
      if (hideErr) return NextResponse.json({ error: `hiding reviews: ${hideErr.message}` }, { status: 500 });
      hiddenCount = reviews.length;
      for (const gymId of new Set(reviews.map((r) => r.gym_id))) {
        const { error } = await service.rpc("refresh_gym_rating", { gym_uuid: gymId });
        if (error) console.error("[moderation] refresh_gym_rating failed:", error.message);
      }
    }
  } else {
    // Unban reverses ONLY the reviews the ban itself auto-hid (reason
    // 'user banned'); anything hidden for other cause stays hidden.
    const { data: reviews, error: readErr } = await service
      .from("gym_reviews")
      .select("id, gym_id")
      .eq("user_id", userId)
      .eq("hidden", true)
      .eq("moderation_reason", "user banned");
    if (readErr) return NextResponse.json({ error: `reading reviews: ${readErr.message}` }, { status: 500 });
    if (reviews && reviews.length > 0) {
      const { error: showErr } = await service
        .from("gym_reviews")
        .update({ hidden: false, moderated_by: staff.userId, moderated_at: now, moderation_reason: null })
        .eq("user_id", userId)
        .eq("hidden", true)
        .eq("moderation_reason", "user banned");
      if (showErr) return NextResponse.json({ error: `restoring reviews: ${showErr.message}` }, { status: 500 });
      restoredCount = reviews.length;
      for (const gymId of new Set(reviews.map((r) => r.gym_id))) {
        const { error } = await service.rpc("refresh_gym_rating", { gym_uuid: gymId });
        if (error) console.error("[moderation] refresh_gym_rating failed:", error.message);
      }
    }
  }

  await logAudit(service, staff.userId, `user.${action}`, "user_moderation", userId, {
    hiddenReviews: hiddenCount,
    restoredReviews: restoredCount,
  });
  return NextResponse.json({ ok: true, hiddenReviews: hiddenCount, restoredReviews: restoredCount });
}
