import { getServerClient } from "@/lib/supabase/server";
import { getAppConfig } from "@/lib/admin/system";
import { PageHeader } from "@/components/admin/ui";
import { ConfigEditor } from "@/components/admin/ConfigEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Flags & Config · Scout Admin" };

export default async function FlagsPage() {
  const client = await getServerClient();
  const entries = await getAppConfig(client);

  return (
    <>
      <PageHeader title="Feature Flags & Config" description="Runtime config and kill-switches. Values are JSON. Owner-only." />
      <ConfigEditor entries={entries} />
    </>
  );
}
