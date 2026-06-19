import { notFound } from "next/navigation";
import { getStaff } from "@/lib/admin/auth";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffList } from "@/lib/admin/system";
import { PageHeader } from "@/components/admin/ui";
import { StaffManager } from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff & Roles · Scout Admin" };

export default async function AccessPage() {
  const me = await getStaff();
  // Only owners manage roles; everyone else 404s this surface.
  if (!me || me.role !== "owner") notFound();

  const client = await getServerClient();
  const staff = await getStaffList(client);

  return (
    <>
      <PageHeader title="Staff & Roles" description="Grant and revoke portal access. Owner-only." />
      <StaffManager staff={staff} selfId={me.userId} />
    </>
  );
}
