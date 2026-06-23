import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/admin/service";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import { hashToken } from "@/lib/owner/token";
import { parseSubmission } from "@/lib/owner/parse";
import { sendEmail, submissionConfirmHtml } from "@/lib/email/send";
import { originAllowed, clientIp, hashIp, burstLimited } from "@/lib/owner/guard";
import type { AnswerMap } from "@/lib/owner/answerTypes";
import type { EnrichedGym } from "@/lib/types/scout";

const MAX_BODY = 256 * 1024; // 256 KB answer-map cap

/** PUBLIC token-gated endpoint: an owner submits their answer map. The submission
 *  is quarantined (status 'pending') — it never touches the catalog until a staff
 *  member publishes it from the owner queue. */
export async function POST(req: NextRequest) {
  // Cross-site / burst abuse guards (the single-use invite token is the real
  // gate; these are cheap defense-in-depth). Origin must be same-site when sent.
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = clientIp(req);
  if (burstLimited(`submit:${ip}`, 12, 60_000)) {
    return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });
  }

  let body: {
    token?: string;
    answers?: AnswerMap;
    contactName?: string;
    contactRole?: string;
    contactEmail?: string;
    note?: string;
  };
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return NextResponse.json({ error: "Submission too large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const answers = body.answers;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return NextResponse.json({ error: "Missing answers" }, { status: 400 });
  }

  const service = getServiceClient();

  // Resolve the token: a real tokenized invite first, else fall back to a gym
  // slug (the prototype link form). Either way we end up with one gym.
  let gym: EnrichedGym | null = null;
  let inviteId: string | null = null;
  const { data: invite } = await service
    .from("owner_invites")
    .select("id, gym_id, status, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  // A real, unexpired, single-use invite is REQUIRED — there is no slug fallback.
  // Unknown tokens 404 (the endpoint never reveals which gyms exist).
  if (!invite) {
    return NextResponse.json({ error: "Invalid or unrecognized invite." }, { status: 404 });
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }
  if (invite.status !== "active") {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 410 });
  }
  const gymId: string = invite.gym_id;

  // Abuse guard (before consuming the invite): cap pending submissions per gym so
  // a leaked invite can't flood the review queue.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentPending } = await service
    .from("owner_submissions")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .eq("status", "pending")
    .gte("created_at", dayAgo);
  if ((recentPending ?? 0) >= 10) {
    return NextResponse.json({ error: "Too many recent submissions for this gym." }, { status: 429 });
  }

  // Durable per-network cap (survives instance recycling, unlike the burst guard).
  const ipHash = hashIp(ip);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentByIp } = await service
    .from("owner_submissions")
    .select("id", { count: "exact", head: true })
    .eq("submitter_ip_hash", ipHash)
    .gte("created_at", hourAgo);
  if ((recentByIp ?? 0) >= 15) {
    return NextResponse.json({ error: "Too many submissions from this network." }, { status: 429 });
  }

  // Atomically claim a single-use invite (active → used). Empty result = a
  // concurrent submit already claimed it → fail closed.
  if (invite) {
    const { data: claimed } = await service
      .from("owner_invites")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", invite.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!claimed) {
      return NextResponse.json({ error: "This invite has already been used." }, { status: 410 });
    }
    inviteId = invite.id;
    [gym] = await fetchGymsByIds(service, [gymId]);
  }
  if (!gym) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const { facts, factCount, conflictCount } = parseSubmission(answers, gym);

  const { data: created, error: insErr } = await service
    .from("owner_submissions")
    .insert({
      gym_id: gym.id,
      invite_id: inviteId,
      contact_name: body.contactName?.trim() || null,
      contact_email: body.contactEmail?.trim() || null,
      contact_role: body.contactRole?.trim() || null,
      raw_answers: answers as never,
      parsed_facts: facts as never,
      fact_count: factCount,
      conflict_count: conflictCount,
      note: body.note?.trim() || null,
      submitter_ip_hash: ipHash,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr) {
    // Roll back the invite claim so the owner can retry.
    if (inviteId) {
      await service.from("owner_invites").update({ status: "active", used_at: null }).eq("id", inviteId);
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  if (inviteId) {
    // Invite was already claimed (status/used_at) above; just link the submission.
    await service.from("owner_invites").update({ submission_id: created.id }).eq("id", inviteId);
  }

  // Best-effort confirmation email to the owner (test mode redirects to the test
  // recipient). Never block the submission on email.
  const ownerEmail = body.contactEmail?.trim();
  if (ownerEmail) {
    await sendEmail({
      to: ownerEmail,
      subject: `We received your ${gym.name} listing`,
      html: submissionConfirmHtml(gym.name),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, submissionId: created.id, factCount, conflictCount });
}
