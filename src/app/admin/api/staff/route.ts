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

  // Resolve email → user id via the service-role admin API. Page through the
  // full user list (a single 200-row page silently failed to find anyone past
  // signup #200); stop early on a short page.
  const PER_PAGE = 200;
  const MAX_PAGES = 100; // safety bound (20k users)
  let user: { id: string } | undefined;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data: list, error: listErr } = await service.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    user = list.users.find((u) => u.email?.toLowerCase() === email);
    if (user || list.users.length < PER_PAGE) break;
  }
  if (!user) {
    return NextResponse.json(
      { error: "No account with that email. Ask them to sign up first, then grant access." },
      { status: 404 },
    );
  }

  // Last-owner / self-demotion guard (mirrors the DELETE handler): don't let the
  // only owner drop their own owner role and lock every owner-gated surface.
  const { data: current } = await service
    .from("staff_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (current?.role === "owner" && role !== "owner") {
    if (user.id === staff.userId) {
      return NextResponse.json({ error: "You cannot demote your own owner access." }, { status: 400 });
    }
    const { count } = await service
      .from("staff_members")
      .select("*", { count: "exact", head: true })
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Cannot demote the last owner." }, { status: 400 });
    }
  }

  const { error } = await service
    .from("staff_members")
    .upsert({ user_id: user.id, role }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(service, staff.userId, "staff.grant", "staff_members", user.id, { email, role });
  return NextResponse.json({ ok: true });
}
