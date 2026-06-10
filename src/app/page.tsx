import { getServerClient } from "@/lib/supabase/server";
import { fetchCityGyms } from "@/lib/queries/gyms";
import { DiscoveryClient } from "@/components/discovery/DiscoveryClient";

// Beta: always read live data (the dataset is actively growing).
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const client = await getServerClient();
  const { city, gyms } = await fetchCityGyms(client, "tampa");

  if (!city) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="display text-3xl text-ink">No territory mapped yet</h1>
        <p className="mt-3 text-sm text-ink/70">
          The Tampa dataset hasn&apos;t been seeded. Run{" "}
          <code className="font-mono rounded bg-paper-raise px-1.5 py-0.5 text-xs">
            node scripts/seed.mjs
          </code>{" "}
          and reload.
        </p>
      </div>
    );
  }

  return <DiscoveryClient city={city} gyms={gyms} />;
}
