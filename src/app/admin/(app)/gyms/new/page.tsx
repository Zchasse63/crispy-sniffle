import { getServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { AddGymForm } from "@/components/admin/AddGymForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add gym · Scout Admin" };

export default async function NewGymPage() {
  const client = await getServerClient();
  const { data: cities } = await client.from("cities").select("id, name, state").order("name");

  return (
    <>
      <PageHeader title="Add gym" description="Creates an unverified listing. Verify it after filling in the facts." />
      <AddGymForm cities={(cities ?? []).map((c) => ({ id: c.id, name: c.name, state: c.state }))} />
    </>
  );
}
