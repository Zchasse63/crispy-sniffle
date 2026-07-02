import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";
import { generateInviteToken, hashToken } from "@/lib/owner/token";
import { sendEmail, requestChangesHtml } from "@/lib/email/send";

const INVITE_TTL_DAYS = 30;

/** Reject or request-changes on a submission (non-publish decisions). For
 *  needs_info we rotate the owner's single-use invite back to active with a fresh
 *  token and email/return a working link, so the owner can re-edit + resubmit. */
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
  const reviewNote = body.reviewNote?.trim() || null;

  // Requesting changes must tell the owner WHAT to change.
  if (action === "needs_info" && !reviewNote) {
    return NextResponse.json({ error: "A review note is required to request changes." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await service
    .from("owner_submissions")
    .update({
      status: action === "reject" ? "rejected" : "needs_info",
      reviewed_by: staff.userId,
      reviewed_at: now,
      review_note: reviewNote,
      ...(action === "needs_info" ? { needs_info_at: now } : {}),
    })
    .eq("id", id)
    .in("status", ["pending", "needs_info"])
    .select("id, gym_id, invite_id, contact_email")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Submission not found or already resolved" }, { status: 404 });

  await logAudit(service, staff.userId, `owner_submission.${action}`, "owner_submissions", id, {
    gym_id: updated.gym_id,
  });

  // Reject is terminal.
  if (action === "reject") return NextResponse.json({ ok: true });

  // needs_info: re-open the owner's link. Only the token_hash is stored, so the
  // old link can't be resurrected — rotate to a fresh token on the SAME invite
  // (used → active) and hand the owner a working link again.
  let link: string | null = null;
  let emailed: { ok: boolean; redirected?: boolean; to?: string; error?: string } | null = null;
  let inviteReopened = false;
  if (updated.invite_id) {
    const newToken = generateInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // Rotate the invite back to active — but NEVER resurrect one an admin
    // explicitly revoked (the status guard makes the update a no-op in that case,
    // so a reviewer can't undo an admin's revocation by re-requesting changes).
    const { data: rotated, error: invErr } = await service
      .from("owner_invites")
      .update({ token_hash: hashToken(newToken), status: "active", used_at: null, expires_at: expiresAt })
      .eq("id", updated.invite_id)
      .neq("status", "revoked")
      .select("id")
      .maybeSingle();
    if (invErr) {
      console.error("[owner-queue] invite reopen failed:", invErr.message);
    } else if (rotated) {
      inviteReopened = true;
      const origin = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.URL ||
        new URL(req.url).origin
      ).replace(/\/+$/, "");
      link = `${origin}/own/${newToken}`;
      const { data: gym } = await service.from("gyms").select("name").eq("id", updated.gym_id).maybeSingle();
      if (updated.contact_email) {
        const res = await sendEmail({
          to: updated.contact_email,
          subject: `A quick change for your ${gym?.name ?? "gym"} listing`,
          html: requestChangesHtml(gym?.name ?? "your gym", link, reviewNote ?? ""),
        });
        emailed = { ok: res.ok, redirected: res.redirected, to: res.to, error: res.error };
        await logAudit(service, staff.userId, "owner_submission.request_changes_email", "owner_submissions", id, {
          ok: res.ok,
          redirected: res.redirected ?? false,
        });
      }
    }
  }

  // The link is returned ONCE so staff can copy/share it (mirrors invite mint).
  // inviteReopened=false with link=null means the invite was revoked and was NOT
  // reopened — staff must mint a fresh invite rather than assume the owner has a link.
  return NextResponse.json({ ok: true, link, emailed, inviteReopened });
}
