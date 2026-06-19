import { getServerClient } from "@/lib/supabase/server";
import { listGymsForAdmin } from "@/lib/admin/gyms-admin";
import { PageHeader, ActionLink } from "@/components/admin/ui";
import { GymTable } from "@/components/admin/GymTable";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gyms · Scout Admin" };

export default async function AdminGymsPage() {
  const client = await getServerClient();
  const gyms = await listGymsForAdmin(client);

  return (
    <>
      <PageHeader
        title="Gyms"
        description={`${gyms.length} locations across all metros`}
        actions={
          <ActionLink href="/admin/gyms/new">
            <Plus className="h-4 w-4" /> Add gym
          </ActionLink>
        }
      />
      <GymTable gyms={gyms} />
    </>
  );
}
