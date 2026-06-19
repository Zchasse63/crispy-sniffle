import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import { EDITABLE_GYM_FIELDS } from "@/lib/admin/gymFields";
import { InspectorEditor } from "@/components/admin/InspectorEditor";
import { PageHeader, Panel, Pill, ProvenancePill, ActionLink } from "@/components/admin/ui";
import {
  EQUIPMENT_LABELS,
  AMENITY_LABELS,
  GYM_STATUS_LABELS,
  type AmenityKey,
} from "@/lib/types/scout";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

type Raw = string | number | boolean | null;

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  active: "good",
  suspect: "warn",
  unverified_new: "warn",
  closed: "bad",
  moved: "neutral",
  duplicate: "neutral",
};

export default async function GymInspectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getServerClient();

  const { data: row, error } = await client.from("gyms").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) notFound();

  const [{ data: city }, [enriched], editLogRes] = await Promise.all([
    client.from("cities").select("name, state, slug").eq("id", row.city_id).maybeSingle(),
    fetchGymsByIds(client, [id]),
    client
      .from("gym_edit_log")
      .select("id, action, field, old_value, new_value, created_at")
      .eq("gym_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const initial: Record<string, Raw> = {};
  for (const key of Object.keys(EDITABLE_GYM_FIELDS)) {
    initial[key] = (row as unknown as Record<string, Raw>)[key] ?? null;
  }

  const editLog = editLogRes.data ?? [];
  const presentAmenities = (enriched?.amenities ?? []).filter((a) => a.present);
  const equipment = enriched?.equipment ?? [];

  return (
    <>
      <PageHeader
        title={row.name}
        description={`${city?.name ?? "Unknown metro"}${city?.state ? `, ${city.state}` : ""} · /${row.slug}`}
        actions={
          city?.slug ? (
            <ActionLink href={`/gym/${row.slug}`} variant="ghost">
              <ExternalLink className="h-4 w-4" /> Public page
            </ActionLink>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Pill tone={STATUS_TONE[row.status] ?? "neutral"}>{GYM_STATUS_LABELS[row.status]}</Pill>
        {row.verified && <Pill tone="good">Scout Verified</Pill>}
        {row.status_note && <span className="text-xs text-mist">Note: {row.status_note}</span>}
      </div>

      <InspectorEditor gymId={id} initial={initial} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title={`Equipment (${equipment.length})`} className="p-4">
          {equipment.length === 0 ? (
            <p className="text-sm text-mist">No equipment recorded.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {equipment.slice(0, 40).map((e) => (
                <li
                  key={e.equipment_key}
                  className="rounded-md border border-paper-line px-2 py-0.5 text-xs text-ink"
                  title={`${e.source} · ${e.confidence.toFixed(2)}${e.brand ? ` · ${e.brand}` : ""}`}
                >
                  {EQUIPMENT_LABELS[e.equipment_key] ?? e.equipment_key}
                  {e.quantity ? <span className="text-mist"> ×{e.quantity}</span> : null}
                </li>
              ))}
              {equipment.length > 40 && (
                <li className="text-xs text-mist">+{equipment.length - 40} more</li>
              )}
            </ul>
          )}
        </Panel>

        <Panel title={`Amenities (${presentAmenities.length})`} className="p-4">
          {presentAmenities.length === 0 ? (
            <p className="text-sm text-mist">No amenities recorded.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {presentAmenities.map((a) => (
                <li
                  key={a.amenity_key}
                  className="rounded-md border border-paper-line px-2 py-0.5 text-xs text-ink"
                  title={`${a.source} · ${a.confidence.toFixed(2)}`}
                >
                  {AMENITY_LABELS[a.amenity_key as AmenityKey] ?? a.amenity_key}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {enriched?.membership_plans && enriched.membership_plans.length > 0 && (
        <Panel title="Membership plans (read-only — structured editor is v2)" className="mt-4 p-4">
          <ul className="flex flex-col gap-1.5 text-sm">
            {enriched.membership_plans.map((p, i) => {
              const monthly = p.prices
                .map((pr) => pr.monthly)
                .filter((m): m is number => m !== null && m !== undefined);
              const from = monthly.length ? Math.min(...monthly) : null;
              return (
                <li
                  key={i}
                  className="flex items-center justify-between border-b border-paper-line/50 pb-1.5 last:border-0"
                >
                  <span className="text-ink">{p.name || `Plan ${i + 1}`}</span>
                  <span className="text-mist">{from !== null ? `$${from}/mo` : "—"}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Panel title="Edit history" className="mt-4">
        {editLog.length === 0 ? (
          <p className="px-4 py-6 text-sm text-mist">No edits recorded yet.</p>
        ) : (
          <ul className="divide-y divide-paper-line/60">
            {editLog.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                <span className="text-ink">
                  <span className="readout uppercase tracking-wide text-mist">{e.action}</span>{" "}
                  {e.field && <span className="font-medium">{e.field}</span>}
                </span>
                <span className="min-w-0 flex-1 truncate text-mist">
                  {fmtVal(e.old_value)} → {fmtVal(e.new_value)}
                </span>
                <time className="shrink-0 text-mist">{new Date(e.created_at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "Unlisted";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
