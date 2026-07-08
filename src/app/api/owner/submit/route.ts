import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/admin/service";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import { hashToken } from "@/lib/owner/token";
import { parseSubmission, type ParseResult } from "@/lib/owner/parse";
import { buildPrefillAnswers } from "@/lib/owner/prefill";
import { KNOWN_FIELD_IDS } from "@/lib/owner/diff";
import { sendEmail, submissionConfirmHtml } from "@/lib/email/send";
import { originAllowed, clientIp, hashIp, burstLimited } from "@/lib/owner/guard";
import type { AnswerMap } from "@/lib/owner/answerTypes";

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
    touchedFields?: string[];
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
  // The client's explicit-interaction signal — unknown ids dropped, capped.
  const rawTouched = body.touchedFields ?? [];
  if (!Array.isArray(rawTouched) || rawTouched.some((x) => typeof x !== "string")) {
    return NextResponse.json({ error: "Invalid touchedFields" }, { status: 400 });
  }
  const touched: ReadonlySet<string> = new Set(
    rawTouched.filter((id) => KNOWN_FIELD_IDS.has(id)).slice(0, 400),
  );

  const service = getServiceClient();

  // Resolve the invite by token hash (a real, single-use invite is required).
  const { data: invite } = await service
    .from("owner_invites")
    .select("id, gym_id, status, expires_at, submission_id")
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

  // A reactivated invite already linking a needs_info submission = a re-edit:
  // update that row in place (revision bump), and skip the public abuse caps
  // since staff explicitly reopened this listing.
  let priorSubmission: { id: string; revision: number } | null = null;
  if (invite.submission_id) {
    const { data: prior } = await service
      .from("owner_submissions")
      .select("id, status, revision")
      .eq("id", invite.submission_id)
      .maybeSingle();
    if (prior && prior.status === "needs_info") {
      priorSubmission = { id: prior.id, revision: prior.revision ?? 1 };
    }
  }

  const ipHash = hashIp(ip);
  if (!priorSubmission) {
    // Cap pending submissions per gym so a leaked invite can't flood the queue.
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
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentByIp } = await service
      .from("owner_submissions")
      .select("id", { count: "exact", head: true })
      .eq("submitter_ip_hash", ipHash)
      .gte("created_at", hourAgo);
    if ((recentByIp ?? 0) >= 15) {
      return NextResponse.json({ error: "Too many submissions from this network." }, { status: 429 });
    }
  }

  // Fetch the gym and parse the submission BEFORE claiming the invite: a
  // deleted gym (404) or a malformed answer map (400) must never burn the
  // single-use invite — only DB-write failures after the claim roll it back.
  const [gym] = await fetchGymsByIds(service, [gymId]);
  if (!gym) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  // Rebuild the exact prefill baseline server-side (pure + deterministic) so
  // untouched prefill can never round-trip into owner-tier facts.
  const baseline = buildPrefillAnswers(gym);
  let parsed: ParseResult;
  try {
    parsed = parseSubmission(answers, gym, { baseline, touched });
  } catch {
    return NextResponse.json({ error: "Malformed answers" }, { status: 400 });
  }
  const { facts, factCount, conflictCount } = parsed;

  // Atomically claim the single-use invite (active → used). Empty result = a
  // concurrent submit already claimed it → fail closed.
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
  const inviteId: string = invite.id;

  const rollbackInvite = () =>
    service.from("owner_invites").update({ status: "active", used_at: null }).eq("id", inviteId);

  const revision = priorSubmission ? priorSubmission.revision + 1 : 1;
  const fields = {
    contact_name: body.contactName?.trim() || null,
    contact_email: body.contactEmail?.trim() || null,
    contact_role: body.contactRole?.trim() || null,
    raw_answers: answers as never,
    // Persist the touched set so a needs_info re-edit re-derives confirmations.
    touched: [...touched] as never,
    parsed_facts: facts as never,
    fact_count: factCount,
    conflict_count: conflictCount,
    note: body.note?.trim() || null,
    submitter_ip_hash: ipHash,
    status: "pending" as const,
  };

  let submissionId: string;
  if (priorSubmission) {
    // Re-edit: update in place + bump revision. KEEP the prior review_note as
    // context for the re-reviewer; the gym_id guard prevents a mismatched
    // overwrite (defense-in-depth — service-role bypasses RLS).
    const { data: upd, error: updErr } = await service
      .from("owner_submissions")
      .update({ ...fields, revision })
      .eq("id", priorSubmission.id)
      .eq("gym_id", gymId)
      .select("id")
      .maybeSingle();
    if (updErr || !upd) {
      await rollbackInvite();
      return NextResponse.json({ error: updErr?.message ?? "Re-edit target mismatch" }, { status: 500 });
    }
    submissionId = priorSubmission.id;
  } else {
    const { data: created, error: insErr } = await service
      .from("owner_submissions")
      .insert({ gym_id: gym.id, invite_id: inviteId, ...fields })
      .select("id")
      .single();
    if (insErr) {
      await rollbackInvite();
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    submissionId = created.id;
  }

  // Link the invite to the submission + clear any saved cross-device draft.
  await service.from("owner_invites").update({ submission_id: submissionId }).eq("id", inviteId);
  await service.from("owner_drafts").delete().eq("invite_id", inviteId);

  // Best-effort confirmation email (test mode redirects to the test recipient).
  const ownerEmail = body.contactEmail?.trim();
  if (ownerEmail) {
    await sendEmail({
      to: ownerEmail,
      subject: `We received your ${gym.name} listing`,
      html: submissionConfirmHtml(gym.name),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, submissionId, factCount, conflictCount, revision });
}
