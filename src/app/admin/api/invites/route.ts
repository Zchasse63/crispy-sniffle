import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";
import { generateInviteToken, hashToken } from "@/lib/owner/token";
import { sendEmail, inviteEmailHtml } from "@/lib/email/send";

const INVITE_TTL_DAYS = 30;

export async function POST(req: NextRequest) {
  const ctx = await requireStaffApi("admin");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;

  let body: { gym_id?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const gymId = (body.gym_id ?? "").trim();
  if (!gymId) return NextResponse.json({ error: "gym_id is required" }, { status: 400 });

  const { data: gym, error: gymErr } = await service
    .from("gyms")
    .select("id, slug, name")
    .eq("id", gymId)
    .maybeSingle();
  if (gymErr) return NextResponse.json({ error: gymErr.message }, { status: 500 });
  if (!gym) return NextResponse.json({ error: "Gym not found" }, { status: 404 });

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error: insErr } = await service
    .from("owner_invites")
    .insert({
      gym_id: gymId,
      token_hash: hashToken(token),
      email: body.email?.trim() || null,
      status: "active",
      created_by: staff.userId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await logAudit(service, staff.userId, "invite.mint", "owner_invites", invite.id, {
    gym_id: gymId,
    gym: gym.name,
  });

  const link = `${new URL(req.url).origin}/own/${token}`;

  // Email the link if an owner address was given (test mode redirects to the
  // configured test recipient and tags the subject).
  let emailed: { ok: boolean; redirected?: boolean; to?: string; error?: string } | null = null;
  if (body.email?.trim()) {
    const res = await sendEmail({
      to: body.email.trim(),
      subject: `Confirm ${gym.name} on Scout`,
      html: inviteEmailHtml(gym.name, link),
    });
    emailed = { ok: res.ok, redirected: res.redirected, to: res.to, error: res.error };
    await logAudit(service, staff.userId, "invite.email", "owner_invites", invite.id, {
      ok: res.ok,
      redirected: res.redirected ?? false,
    });
  }

  // The raw token is returned ONCE — only its hash is stored.
  return NextResponse.json({
    ok: true,
    id: invite.id,
    token,
    path: `/own/${token}`,
    link,
    gymName: gym.name,
    expiresAt,
    emailed,
  });
}
