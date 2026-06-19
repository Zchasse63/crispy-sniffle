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
  if (action === "ban") {
    const { data: reviews } = await service
      .from("gym_reviews")
      .select("id, gym_id")
      .eq("user_id", userId)
      .eq("hidden", false);
    if (reviews && reviews.length > 0) {
      await service
        .from("gym_reviews")
        .update({ hidden: true, moderated_by: staff.userId, moderated_at: now, moderation_reason: "user banned" })
        .eq("user_id", userId)
        .eq("hidden", false);
      hiddenCount = reviews.length;
      for (const gymId of new Set(reviews.map((r) => r.gym_id))) {
        const { error } = await service.rpc("refresh_gym_rating", { gym_uuid: gymId });
        if (error) console.error("[moderation] refresh_gym_rating failed:", error.message);
      }
    }
  }

  await logAudit(service, staff.userId, `user.${action}`, "user_moderation", userId, { hiddenReviews: hiddenCount });
  return NextResponse.json({ ok: true, hiddenReviews: hiddenCount });
}
