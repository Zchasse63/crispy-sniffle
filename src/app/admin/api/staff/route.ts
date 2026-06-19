import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";

const ROLES = new Set(["owner", "admin", "reviewer", "viewer"]);

/** Grant (or change) a staff role by email. Owner-only. The target must already
 *  have an auth account (signed up). */
export async function POST(req: NextRequest) {
  const ctx = await requireStaffApi("owner");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role;
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!role || !ROLES.has(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  // Resolve email → user id via the service-role admin API.
  const { data: list, error: listErr } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const user = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    return NextResponse.json(
      { error: "No account with that email. Ask them to sign up first, then grant access." },
      { status: 404 },
    );
  }

  const { error } = await service
    .from("staff_members")
    .upsert({ user_id: user.id, role }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(service, staff.userId, "staff.grant", "staff_members", user.id, { email, role });
  return NextResponse.json({ ok: true });
}
