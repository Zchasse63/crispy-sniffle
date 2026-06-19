import { getServerClient } from "@/lib/supabase/server";
import { PageHeader, Panel, Pill, StatTile } from "@/components/admin/ui";
import { DeferredPanel } from "@/components/admin/DeferredPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ops & Health · Scout Admin" };

// Secrets are listed by name + rotation status only — never values.
const SECRETS = [
  { name: "SUPABASE_SERVICE_ROLE_KEY", note: "loaders + admin write path" },
  { name: "SUPABASE_ACCESS_TOKEN", note: "Management API PAT" },
  { name: "RESEND_API_KEY", note: "email (also in Vault)" },
  { name: "MAPBOX_SECRET_TOKEN", note: "server geocoding" },
  { name: "ANTHROPIC_API_KEY", note: "Vault only — ai-search" },
];

const EDGE_FUNCTIONS = [{ name: "ai-search", note: "NL → FilterSet (verify_jwt=false by design)" }];

export default async function SystemPage() {
  const client = await getServerClient();
  let dbOk = false;
  try {
    const { error } = await client.from("gyms").select("id", { count: "exact", head: true });
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  return (
    <>
      <PageHeader title="Ops & Health" description="Database, edge functions, and secret-rotation status." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Database" value={dbOk ? "OK" : "Down"} tone={dbOk ? "good" : "bad"} sub="Postgres + PostGIS" />
        <StatTile label="Edge functions" value={EDGE_FUNCTIONS.length} tone="info" sub="deployed" />
        <StatTile label="Secrets tracked" value={SECRETS.length} tone="neutral" sub="rotation queued" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Edge functions" className="p-4">
          <ul className="flex flex-col gap-2">
            {EDGE_FUNCTIONS.map((f) => (
              <li key={f.name} className="flex items-center justify-between text-sm">
                <span className="text-ink">{f.name}</span>
                <span className="text-xs text-mist">{f.note}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Secret-rotation board" className="p-4">
          <ul className="flex flex-col gap-2">
            {SECRETS.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <code className="text-xs text-ink">{s.name}</code>
                  <p className="text-[11px] text-mist">{s.note}</p>
                </div>
                <Pill tone="warn">rotate post-beta</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4">
        <DeferredPanel
          reason="Live edge/DB advisors, storage usage, and migration-drift status need the admin-ops edge function (a Management API bridge). The board above shows what's known statically."
          gate="Build the admin-ops edge fn (advisors / migrations / edge / storage) for live health."
        />
      </div>
    </>
  );
}
