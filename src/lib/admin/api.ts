import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getStaff, hasMinRole, type StaffRole, type StaffSession } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/admin/service";

type Service = SupabaseClient<Database>;

export interface StaffContext {
  staff: StaffSession;
  service: Service;
}

/** Gate a Route Handler on staff membership (and an optional minimum role).
 *  Returns the staff session + a service-role client, or a JSON error Response
 *  the caller must early-return. */
export async function requireStaffApi(
  minRole: StaffRole = "viewer",
): Promise<StaffContext | { response: NextResponse }> {
  const staff = await getStaff();
  if (!staff) {
    return { response: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }
  if (!hasMinRole(staff.role, minRole)) {
    return {
      response: NextResponse.json({ error: "Insufficient role" }, { status: 403 }),
    };
  }
  return { staff, service: getServiceClient() };
}

export function isError(r: StaffContext | { response: NextResponse }): r is { response: NextResponse } {
  return "response" in r;
}

/** Write an admin_audit_log row using the service client (actor = the staff
 *  user, since the service role itself has no auth.uid()). */
export async function logAudit(
  service: Service,
  actor: string,
  action: string,
  targetTable: string | null,
  targetId: string | null,
  detail: Record<string, unknown> | null = null,
): Promise<boolean> {
  const { error } = await service.from("admin_audit_log").insert({
    actor,
    action,
    target_table: targetTable,
    target_id: targetId,
    detail: detail as Database["public"]["Tables"]["admin_audit_log"]["Insert"]["detail"],
  });
  if (error) {
    console.error("[audit] admin_audit_log insert failed:", action, error.message);
    return false;
  }
  return true;
}

export interface GymEditEntry {
  gym_id: string;
  actor: string;
  action: string;
  field?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  source?: string | null;
  confidence?: number | null;
}

/** Append one or more rows to gym_edit_log. */
export async function logGymEdits(service: Service, entries: GymEditEntry[]): Promise<boolean> {
  if (entries.length === 0) return true;
  const { error } = await service.from("gym_edit_log").insert(
    entries.map((e) => ({
      gym_id: e.gym_id,
      actor: e.actor,
      action: e.action,
      field: e.field ?? null,
      old_value: (e.old_value ?? null) as Database["public"]["Tables"]["gym_edit_log"]["Insert"]["old_value"],
      new_value: (e.new_value ?? null) as Database["public"]["Tables"]["gym_edit_log"]["Insert"]["new_value"],
      source: e.source ?? null,
      confidence: e.confidence ?? null,
    })),
  );
  if (error) {
    console.error("[audit] gym_edit_log insert failed:", error.message);
    return false;
  }
  return true;
}
