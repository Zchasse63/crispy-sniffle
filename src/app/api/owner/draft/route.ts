import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/admin/service";
import { hashToken } from "@/lib/owner/token";
import { originAllowed, clientIp, burstLimited } from "@/lib/owner/guard";
import { CONFIG_VERSION } from "@/lib/owner/persistence";
import type { AnswerMap } from "@/lib/owner/answerTypes";

const MAX_BODY = 256 * 1024;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // mirror localStorage staleness gate

/** Resolve an invite by raw token WITHOUT consuming it — only an active,
 *  unexpired invite has a resumable draft. */
async function resolveInvite(token: string) {
  if (!token) return null;
  const service = getServiceClient();
  const { data: invite } = await service
    .from("owner_invites")
    .select("id, gym_id, status, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!invite || invite.status !== "active") return null;
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return null;
  return invite;
}

// GET /api/owner/draft?token=... → { draft } | { draft: null }
export async function GET(req: NextRequest) {
  const token = (new URL(req.url).searchParams.get("token") ?? "").trim();
  const invite = await resolveInvite(token);
  if (!invite) return NextResponse.json({ draft: null });

  const service = getServiceClient();
  const { data: row } = await service
    .from("owner_drafts")
    .select("answers, completed_sections, touched, contact_name, contact_role, version, updated_at")
    .eq("invite_id", invite.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ draft: null });

  // Discard a stale-shape or >30d draft server-side (mirror persistence.ts).
  const age = Date.now() - new Date(row.updated_at).getTime();
  if (row.version !== CONFIG_VERSION || !Number.isFinite(age) || age > MAX_AGE_MS) {
    return NextResponse.json({ draft: null });
  }

  return NextResponse.json({
    draft: {
      token,
      gymId: invite.gym_id,
      version: row.version,
      answers: row.answers,
      completedSections: Array.isArray(row.completed_sections) ? row.completed_sections : [],
      touched: Array.isArray(row.touched) ? row.touched : [],
      contactName: row.contact_name ?? "",
      contactRole: row.contact_role ?? "",
      lastSaved: row.updated_at,
    },
  });
}

// PUT /api/owner/draft  body { token, version, answers, completedSections, contactName, contactRole }
export async function PUT(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Autosave is frequent (debounced) — a higher burst ceiling than submit.
  if (burstLimited(`draft:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: {
    token?: string;
    version?: number;
    answers?: AnswerMap;
    completedSections?: string[];
    touched?: string[];
    contactName?: string;
    contactRole?: string;
  };
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return NextResponse.json({ error: "Draft too large" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  // A draft from an older form shape is dropped rather than persisted.
  if (body.version !== CONFIG_VERSION) return NextResponse.json({ error: "Stale draft version" }, { status: 409 });
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Missing answers" }, { status: 400 });
  }

  const invite = await resolveInvite(token);
  if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 404 });

  const service = getServiceClient();
  const { error } = await service.from("owner_drafts").upsert(
    {
      invite_id: invite.id,
      gym_id: invite.gym_id,
      version: CONFIG_VERSION,
      answers: body.answers as never,
      completed_sections: (Array.isArray(body.completedSections) ? body.completedSections : []) as never,
      touched: (Array.isArray(body.touched) ? body.touched : []) as never,
      contact_name: body.contactName?.trim() || null,
      contact_role: body.contactRole?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "invite_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/owner/draft  body { token }  (used by "start over")
export async function DELETE(req: NextRequest) {
  if (!originAllowed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let token = "";
  try {
    token = (JSON.parse((await req.text()) || "{}").token ?? "").trim();
  } catch {
    /* ignore */
  }
  if (!token) token = (new URL(req.url).searchParams.get("token") ?? "").trim();
  const invite = await resolveInvite(token);
  if (!invite) return NextResponse.json({ ok: true }); // invalid / already-consumed → no-op
  const service = getServiceClient();
  await service.from("owner_drafts").delete().eq("invite_id", invite.id);
  return NextResponse.json({ ok: true });
}
