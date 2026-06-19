import "server-only";
import { getServerClient } from "@/lib/supabase/server";

export type StaffRole = "owner" | "admin" | "reviewer" | "viewer";

const RANK: Record<StaffRole, number> = { viewer: 1, reviewer: 2, admin: 3, owner: 4 };

export interface StaffSession {
  userId: string;
  email: string;
  role: StaffRole;
}

/** Server-side: the staff session, or null when not authenticated / not staff.
 *  Non-staff get null → callers 404 (the admin surface stays undiscoverable). */
export async function getStaff(): Promise<StaffSession | null> {
  const client = await getServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data: role } = await client.rpc("my_staff_role");
  if (!role) return null;
  return { userId: user.id, email: user.email ?? "", role: role as StaffRole };
}

export function hasMinRole(role: StaffRole, min: StaffRole): boolean {
  return RANK[role] >= RANK[min];
}
