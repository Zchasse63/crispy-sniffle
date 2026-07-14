"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Clock, MapPin, Minus, Star } from "lucide-react";
import { openStatus, type OpenStatus } from "@/lib/hours";
import {
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
  type GymEquipmentRecord,
  type ScoredGym,
} from "@/lib/types/scout";
import { deriveAccessStatus } from "@/lib/access";
import { gymPhotoUrl } from "@/lib/gymPhotoUrl";
import { MatchBadge } from "./MatchBadge";
import { AccessBadge } from "./AccessBadge";
import { ShortlistButton } from "@/components/shortlist/ShortlistButton";
import { SegmentScene } from "@/components/brand/SegmentScene";

const SEGMENT_GRADIENTS: Record<string, string> = {
  strength: "from-ink-raise to-ink-deep",
  crossfit: "from-[#2a3c46] to-ink-deep",
  big_box: "from-[#243c4a] to-ink-deep",
  boutique: "from-[#37323f] to-ink-deep",
  climbing: "from-[#3c3a2c] to-ink-deep",
  yoga_pilates: "from-[#2c3c38] to-ink-deep",
  mma: "from-[#3c2c2c] to-ink-deep",
  recovery: "from-[#2c3a3c] to-ink-deep",
  luxury: "from-[#3a3330] to-ink-deep",
  cycling: "from-[#2c3646] to-ink-deep",
  barre: "from-[#3a2f38] to-ink-deep",
};

/**
 * Rich-tier differentiator: up to 2 equipment hook facts, prioritized by
 * (a) quantified racks/platforms, (b) branded barbells, (c) dumbbell max
 * weight. Labels come straight from EQUIPMENT_LABELS (scout.ts) — never a
 * second label map. Basic-tier gyms carry no equipment rows and get no line
 * at all (no placeholder).
 */
function equipmentHookFacts(equipment: GymEquipmentRecord[]): string[] {
  const facts: string[] = [];

  // (a) quantified racks/platforms — first match wins, in strength-signal order.
  for (const key of ["squat_rack", "power_rack", "platform"] as const) {
    const rec = equipment.find((e) => e.equipment_key === key);
    if (rec?.quantity) {
      facts.push(`${rec.quantity}× ${EQUIPMENT_LABELS[key].toLowerCase()}`);
      break;
    }
  }

  // (b) branded barbells.
  const barbells = equipment.find((e) => e.equipment_key === "barbells");
  if (barbells?.brand) {
    facts.push(`${barbells.brand} ${EQUIPMENT_LABELS.barbells.toLowerCase()}`);
  }

  // (c) dumbbell max weight.
  const dumbbells = equipment.find((e) => e.equipment_key === "dumbbells");
  if (dumbbells && dumbbells.max_weight_lbs !== null) {
    facts.push(`Dumbbells to ${dumbbells.max_weight_lbs} lbs`);
  }

  return facts.slice(0, 2);
}

export function GymCard({
  gym,
  onHover,
  isHighlighted = false,
}: {
  gym: ScoredGym;
  onHover?: (id: string | null) => void;
  isHighlighted?: boolean;
}) {
  const presentAmenities = gym.amenities.filter((a) => a.present).slice(0, 4);
  const access = deriveAccessStatus(gym);
  const hookFacts = equipmentHookFacts(gym.equipment);
  // time-dependent → client-only after mount (avoids SSR/hydration text drift);
  // deferred a frame so the setState isn't synchronous inside the effect body
  // (react-hooks/set-state-in-effect — same defer pattern as TrainHereButton)
  const [status, setStatus] = useState<OpenStatus | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setStatus(openStatus(gym.hours)));
    return () => cancelAnimationFrame(id);
  }, [gym.hours]);
  return (
    <Link
      href={`/gym/${gym.slug}`}
      onMouseEnter={() => onHover?.(gym.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group block overflow-hidden rounded-xl border bg-paper-raise transition-all duration-300 hover:-translate-y-1 hover:border-ink/30 hover:shadow-[0_18px_44px_-28px_rgba(22,36,46,0.5)] ${
        isHighlighted
          ? "border-pool shadow-[0_0_0_1px_var(--color-pool)]"
          : "border-paper-line"
      }`}
    >
      {/* photo / placeholder */}
      <div
        className={`relative h-40 overflow-hidden bg-gradient-to-br ${
          SEGMENT_GRADIENTS[gym.segment ?? "big_box"] ?? SEGMENT_GRADIENTS.big_box
        }`}
      >
        {gym.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // List card renders small — request a 640px transform, not the 1280 default.
            src={gymPhotoUrl(gym.photo_storage_path, gym.photo_url, { width: 640 }) ?? gym.photo_url}
            alt={gym.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]">
            <SegmentScene segment={gym.segment} />
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {gym.matchScore !== null && (
            <MatchBadge
              score={gym.matchScore}
              reasons={gym.matchReasons}
              missingItems={gym.missingItems}
            />
          )}
        </div>
        <ShortlistButton gymId={gym.id} className="absolute right-3 top-3" />
        {gym.segment && (
          <span className="readout absolute bottom-3 left-3 rounded bg-ink/70 px-2 py-1 text-paper backdrop-blur-sm">
            {SEGMENT_LABELS[gym.segment]}
          </span>
        )}
      </div>

      {/* body */}
      <div className="p-4">
        <h3 className="display text-[17px] tracking-wide text-ink">{gym.name}</h3>
        <div className="readout mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink/70">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden />
            {gym.neighborhood ?? "Tampa"}
          </span>
          <span className="opacity-40">·</span>
          {access.derivable ? (
            <AccessBadge gym={gym} context="card" />
          ) : (
            <span className="text-ink/45">Day pass unlisted</span>
          )}
          {status && (
            <>
              <span className="opacity-40">·</span>
              <span
                className={`inline-flex items-center gap-1 ${
                  status.closingSoon
                    ? "font-semibold text-blaze-deep"
                    : status.open
                      ? "text-pool-deep"
                      : "text-ink/60"
                }`}
              >
                <Clock className="h-3 w-3" aria-hidden />
                {status.label}
              </span>
            </>
          )}
          {gym.rating !== null && (
            <>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-pool text-pool" aria-hidden />
                {Number(gym.rating).toFixed(1)}
                {gym.rating_count > 0 && (
                  <span className="opacity-60">({gym.rating_count})</span>
                )}
              </span>
            </>
          )}
        </div>

        {presentAmenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {presentAmenities.map((a) => (
              <span
                key={a.amenity_key}
                className="font-mono rounded border border-ink-line/20 bg-paper px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/70"
              >
                {a.amenity_key === "parking" &&
                gym.parking.some((p) => p.access === "free" || p.access === "customers")
                  ? "free parking"
                  : a.amenity_key.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {hookFacts.length > 0 && (
          <p className="mt-2 font-mono text-[11px] tracking-wide text-ink/60">
            {hookFacts.join(" · ")}
          </p>
        )}

        {gym.matchScore !== null && gym.matchReasons.length > 0 && (
          <div className="mt-3 border-t border-paper-line pt-2.5 text-xs leading-relaxed text-ink/70">
            <span className="inline-flex items-start gap-1.5">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blaze" aria-hidden />
              <span>
                <b className="font-semibold text-ink">Why it fits:</b>{" "}
                {gym.matchReasons.slice(0, 3).join(" · ")}
                {gym.missingItems.length > 0 && (
                  <span className="mt-0.5 flex items-start gap-1.5 text-ink/65">
                    <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {gym.missingItems[0]}
                  </span>
                )}
              </span>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
