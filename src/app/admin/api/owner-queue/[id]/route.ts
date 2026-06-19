import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";

/** Reject or flag-needs-info on a submission (non-publish decisions). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffApi("reviewer");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const { id } = await params;

  let body: { action?: string; reviewNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "reject" && action !== "needs_info") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const { data: updated, error } = await service
    .from("owner_submissions")
    .update({
      status: action === "reject" ? "rejected" : "needs_info",
      reviewed_by: staff.userId,
      reviewed_at: new Date().toISOString(),
      review_note: body.reviewNote?.trim() || null,
    })
    .eq("id", id)
    .in("status", ["pending", "needs_info"])
    .select("id, gym_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Submission not found or already resolved" }, { status: 404 });

  await logAudit(service, staff.userId, `owner_submission.${action}`, "owner_submissions", id, {
    gym_id: updated.gym_id,
  });
  return NextResponse.json({ ok: true });
}
