import { Building2, Car, CircleParking, MapPin } from "lucide-react";
import { parkingHeadline, parkingSummary, walkMinutes } from "@/lib/parking";
import { ProvenanceBadge } from "./ProvenanceBadge";
import type { GymParkingRecord, ParkingKind } from "@/lib/types/scout";

const KIND_ICONS: Record<ParkingKind, React.ComponentType<{ className?: string }>> = {
  onsite_lot: CircleParking,
  nearby_lot: CircleParking,
  onsite_garage: Building2,
  nearby_garage: Building2,
  street: MapPin,
  valet: Car,
};

/** Badge only when it informs: community/inferred sources or shaky confidence. */
const showBadge = (p: GymParkingRecord) =>
  p.source === "osm" ||
  p.source === "city_data" ||
  p.source === "estimated" ||
  p.confidence < 0.7;

/**
 * "Will I find parking?" — answered before the drive.
 * Primary recommendation up top, alternatives below, sources visible.
 */
export function ParkingCard({ parking }: { parking: GymParkingRecord[] }) {
  const summary = parkingSummary(parking);
  if (!summary) return null;
  const PrimaryIcon = KIND_ICONS[summary.primary.kind];

  return (
    <section className="rounded-xl border border-paper-line bg-paper-raise p-5">
      <h2 className="readout flex items-center gap-1.5 text-ink/65">
        <CircleParking className="h-3.5 w-3.5" aria-hidden /> Parking
      </h2>

      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="flex items-start gap-2 text-sm font-semibold leading-snug text-ink">
          <PrimaryIcon className="mt-0.5 h-4 w-4 shrink-0 text-pool" aria-hidden />
          <span>
            {summary.headline}
            {summary.primary.distance_m !== null && summary.primary.distance_m > 0 && (
              <span className="font-mono ml-1.5 text-[10px] font-normal uppercase tracking-wide text-ink/65">
                {walkMinutes(summary.primary.distance_m)}
              </span>
            )}
          </span>
        </p>
        {showBadge(summary.primary) && (
          <ProvenanceBadge
            source={summary.primary.source}
            confidence={summary.primary.confidence}
            detail={summary.primary.detail}
          />
        )}
      </div>
      {summary.primary.detail &&
        summary.primary.detail !== summary.headline &&
        summary.primary.source === "scraped" && (
          <p className="mt-1.5 pl-6 text-xs leading-relaxed text-ink/70">
            {summary.primary.detail}
          </p>
        )}

      {summary.alternatives.length > 0 && (
        <ul className="mt-3 divide-y divide-paper-line/60 border-t border-paper-line/60">
          {summary.alternatives.map((p) => {
            const Icon = KIND_ICONS[p.kind];
            return (
              <li
                key={p.id}
                title={p.detail ?? undefined}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 text-xs text-ink/80">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-ink/50" aria-hidden />
                  <span className="min-w-0">
                    {parkingHeadline(p)}
                    {p.distance_m !== null && p.distance_m > 0 && (
                      <span className="font-mono ml-1.5 text-[10px] uppercase tracking-wide text-ink/55">
                        {walkMinutes(p.distance_m)}
                      </span>
                    )}
                  </span>
                </span>
                {showBadge(p) && (
                  <ProvenanceBadge
                    source={p.source}
                    confidence={p.confidence}
                    detail={p.detail}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {summary.hasOsmSource && (
        <p className="mt-3 text-[10.5px] text-ink/65">
          Parking data © OpenStreetMap contributors
        </p>
      )}
    </section>
  );
}
