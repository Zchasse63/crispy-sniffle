import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getMetro } from "@/lib/admin/metros";
import { PageHeader, Pill, StatTile, ActionLink } from "@/components/admin/ui";
import { GymTable } from "@/components/admin/GymTable";
import { TierToggle } from "@/components/admin/MetroControls";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MetroCockpit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getServerClient();
  const metro = await getMetro(client, id);
  if (!metro) notFound();

  const verified = metro.gyms.filter((g) => g.verified).length;
  const priceGaps = metro.gyms.filter((g) => !g.hasPrice).length;
  const avg = metro.gyms.length
    ? Math.round(metro.gyms.reduce((s, g) => s + g.completeness, 0) / metro.gyms.length)
    : 0;

  return (
    <>
      <PageHeader
        title={`${metro.name}, ${metro.state}`}
        description={`/${metro.slug} · center ${metro.lat.toFixed(3)}, ${metro.lng.toFixed(3)}`}
        actions={
          <ActionLink href={`/${metro.slug}`} variant="ghost">
            <ExternalLink className="h-4 w-4" /> Public page
          </ActionLink>
        }
      />

      <div className="mb-5 flex items-center gap-2">
        <Pill tone={metro.tier === "rich" ? "good" : "neutral"}>{metro.tier} tier</Pill>
        <TierToggle id={metro.id} tier={metro.tier} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Gyms" value={metro.gyms.length} tone="info" />
        <StatTile label="Verified" value={verified} tone={verified > 0 ? "good" : "neutral"} />
        <StatTile label="Avg complete" value={`${avg}%`} tone={avg >= 70 ? "good" : "warn"} />
        <StatTile label="Price gaps" value={priceGaps} tone={priceGaps > 0 ? "warn" : "good"} />
      </div>

      {metro.gyms.length > 0 ? (
        <GymTable gyms={metro.gyms} />
      ) : (
        <p className="rounded-xl border border-paper-line bg-paper-raise px-4 py-12 text-center text-sm text-mist">
          No gyms in this metro yet. Add gyms from the catalog or run the data pipeline (gated).
        </p>
      )}
    </>
  );
}
