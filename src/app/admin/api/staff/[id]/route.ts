import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";

/** Revoke a staff member. Owner-only. Refuses to remove the last owner (lockout
 *  guard) and refuses self-revocation. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffApi("owner");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const { id } = await params;

  if (id === staff.userId) {
    return NextResponse.json({ error: "You cannot revoke your own access." }, { status: 400 });
  }

  const { data: target } = await service.from("staff_members").select("role").eq("user_id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Not a staff member" }, { status: 404 });

  if (target.role === "owner") {
    const { count } = await service
      .from("staff_members")
      .select("*", { count: "exact", head: true })
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Cannot remove the last owner." }, { status: 400 });
    }
  }

  const { error } = await service.from("staff_members").delete().eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(service, staff.userId, "staff.revoke", "staff_members", id, null);
  return NextResponse.json({ ok: true });
}
