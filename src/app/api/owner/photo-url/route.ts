import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/admin/service";
import { hashToken } from "@/lib/owner/token";
import { originAllowed, clientIp, burstLimited } from "@/lib/owner/guard";

const BUCKET = "owner-photos";
const OK_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const PER_GYM_CAP = 60; // safety net so a valid-invite holder can't fill storage

/**
 * PUBLIC token-gated endpoint. Validates the invite, then hands back a one-time
 * signed upload URL scoped to a gym-id path. The client uploads with
 * uploadToSignedUrl — which is service-authorized, so the bucket needs no open
 * anon-insert policy. This is the only sanctioned way to write owner photos.
 */
export async function POST(req: NextRequest) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (burstLimited(`photo:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests — slow down." }, { status: 429 });
  }

  let body: { token?: string; ext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = (body.token ?? "").trim();
  const ext = (body.ext ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  if (!OK_EXT.has(ext)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const service = getServiceClient();
  const { data: invite } = await service
    .from("owner_invites")
    .select("id, gym_id, status, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }
  if (invite.status !== "active") {
    return NextResponse.json({ error: "This invite is no longer active." }, { status: 410 });
  }

  // Per-gym storage quota (safety net against a runaway client).
  const { data: existing } = await service.storage
    .from(BUCKET)
    .list(invite.gym_id, { limit: PER_GYM_CAP + 1 });
  if ((existing?.length ?? 0) >= PER_GYM_CAP) {
    return NextResponse.json({ error: "Photo limit reached for this listing." }, { status: 429 });
  }

  const path = `${invite.gym_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data: signed, error } = await service.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !signed) {
    return NextResponse.json({ error: "Could not prepare upload." }, { status: 500 });
  }
  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ path: signed.path, token: signed.token, url: pub.publicUrl });
}
