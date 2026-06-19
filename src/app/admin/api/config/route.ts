import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit } from "@/lib/admin/api";
import type { Database } from "@/lib/types/database";

/** Set a runtime config / feature-flag value. Owner-only (kill-switches). */
export async function POST(req: NextRequest) {
  const ctx = await requireStaffApi("owner");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;

  let body: { key?: string; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const key = (body.key ?? "").trim();
  if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 });
  if (body.value === undefined) return NextResponse.json({ error: "Value is required" }, { status: 400 });

  const { error } = await service.from("app_config").upsert(
    {
      key,
      value: body.value as Database["public"]["Tables"]["app_config"]["Insert"]["value"],
      updated_by: staff.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(service, staff.userId, "config.set", "app_config", key, { value: body.value });
  return NextResponse.json({ ok: true });
}

/** Delete a config key. */
export async function DELETE(req: NextRequest) {
  const ctx = await requireStaffApi("owner");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 });

  const { error } = await service.from("app_config").delete().eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit(service, staff.userId, "config.delete", "app_config", key, null);
  return NextResponse.json({ ok: true });
}
