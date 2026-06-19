import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";

/** Revoke an invite (status → 'revoked'). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffApi("admin");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const { id } = await params;

  let action = "revoke";
  try {
    const body = await req.json();
    if (body?.action) action = String(body.action);
  } catch {
    /* default revoke */
  }
  if (action !== "revoke") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const { data: updated, error } = await service
    .from("owner_invites")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("status", "active") // only active invites can be revoked
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Invite not found or not active" }, { status: 404 });

  await logAudit(service, staff.userId, "invite.revoke", "owner_invites", id, null);
  return NextResponse.json({ ok: true });
}
