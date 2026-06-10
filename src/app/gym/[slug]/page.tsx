import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Navigation, Phone, Star } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { fetchGymBySlug, fetchCityGyms } from "@/lib/queries/gyms";
import {
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
  type AmenityKey,
  type EnrichedGym,
  type ScoredGym,
} from "@/lib/types/scout";
import { AttributeSection, type AttributeItem } from "@/components/gym/AttributeSection";
import { HoursDisplay } from "@/components/gym/HoursDisplay";
import { GymMiniMap } from "@/components/gym/GymMiniMap";
import { GymCard } from "@/components/gym/GymCard";
import { ShortlistButton } from "@/components/shortlist/ShortlistButton";
import { SignalPin } from "@/components/brand/SignalPin";
import { SegmentScene } from "@/components/brand/SegmentScene";

/** Amenities worth leading with, in priority order. */
const HIGHLIGHT_ORDER: AmenityKey[] = [
  "sauna",
  "cold_plunge",
  "steam_room",
  "pool",
  "recovery_room",
  "turf_area",
  "basketball_court",
  "classes",
  "childcare",
  "towel_service",
  "personal_training",
];

export const dynamic = "force-dynamic";

const AMENITY_LABELS: Record<string, string> = {
  sauna: "Sauna",
  cold_plunge: "Cold Plunge",
  steam_room: "Steam Room",
  pool: "Pool",
  recovery_room: "Recovery Room",
  open_24h: "24-Hour Access",
  classes: "Group Classes",
  personal_training: "Personal Training",
  turf_area: "Turf Area",
  cardio_zone: "Cardio Zone",
  basketball_court: "Basketball Court",
  day_pass: "Day Passes",
  parking: "Parking",
  lockers: "Locker Rooms",
  showers: "Showers",
  towel_service: "Towel Service",
  wifi: "Wi-Fi",
  juice_bar: "Juice Bar",
  childcare: "Childcare",
};

const RECOVERY_KEYS: AmenityKey[] = ["sauna", "cold_plunge", "steam_room", "pool", "recovery_room"];
const TRAINING_KEYS: AmenityKey[] = ["classes", "personal_training", "turf_area", "cardio_zone", "basketball_court"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await getServerClient();
  const gym = await fetchGymBySlug(client, slug);
  if (!gym) return { title: "Gym not found — Scout" };
  return {
    title: `${gym.name} — Scout`,
    description: gym.description ?? `${gym.name} in ${gym.neighborhood ?? "Tampa"} on Scout.`,
  };
}

function equipmentValue(e: EnrichedGym["equipment"][number]): string | null {
  const parts: string[] = [];
  if (e.quantity && e.quantity > 1) parts.push(`${e.quantity}×`);
  if (e.max_weight_lbs) parts.push(`to ${e.max_weight_lbs} lbs`);
  if (e.brand) parts.push(e.brand);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default async function GymDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getServerClient();
  const gym = await fetchGymBySlug(client, slug);
  if (!gym) notFound();

  const equipment: AttributeItem[] = gym.equipment.map((e) => ({
    key: e.equipment_key,
    label: EQUIPMENT_LABELS[e.equipment_key],
    value: equipmentValue(e),
    present: true,
    source: e.source,
    confidence: e.confidence,
    detail: e.detail,
  }));
  const byKeys = (keys: AmenityKey[]): AttributeItem[] =>
    gym.amenities
      .filter((a) => keys.includes(a.amenity_key))
      .map((a) => ({
        key: a.amenity_key,
        label: AMENITY_LABELS[a.amenity_key] ?? a.amenity_key,
        value: null,
        present: a.present,
        source: a.source,
        confidence: a.confidence,
        detail: a.detail,
      }));
  const facility: AttributeItem[] = gym.amenities
    .filter((a) => !RECOVERY_KEYS.includes(a.amenity_key) && !TRAINING_KEYS.includes(a.amenity_key))
    .map((a) => ({
      key: a.amenity_key,
      label: AMENITY_LABELS[a.amenity_key] ?? a.amenity_key,
      value: null,
      present: a.present,
      source: a.source,
      confidence: a.confidence,
      detail: a.detail,
    }));

  // similar gyms: same segment, same city
  const { gyms: cityGyms } = await fetchCityGyms(client, "tampa");
  const similar: ScoredGym[] = cityGyms
    .filter((g) => g.id !== gym.id && g.segment === gym.segment)
    .slice(0, 4)
    .map((g) => ({ ...g, matchScore: null, matchReasons: [], missingItems: [] }));

  const presentKeys = new Set(
    gym.amenities.filter((a) => a.present).map((a) => a.amenity_key),
  );
  const highlights = HIGHLIGHT_ORDER.filter((k) => presentKeys.has(k)).slice(0, 5);
  const directionsUrl =
    gym.lat !== null && gym.lng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lng}`
      : gym.address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${gym.name}, ${gym.address}`)}`
        : null;
  const factCount = gym.amenities.length + gym.equipment.length;

  return (
    <div className="flex-1">
      {/* hero */}
      <section className="survey-grid-night relative overflow-hidden bg-ink-deep">
        {gym.photo_url ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[44%] lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gym.photo_url}
              alt=""
              className="h-full w-full object-cover opacity-45"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-deep via-ink-deep/55 to-transparent" />
          </div>
        ) : (
          <div className="pointer-events-none absolute right-0 top-1/2 hidden w-[420px] -translate-y-1/2 opacity-[0.22] lg:block">
            <SegmentScene segment={gym.segment} className="h-[240px] w-full" />
          </div>
        )}
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Link
            href="/"
            className="readout inline-flex items-center gap-1.5 text-mist transition-colors hover:text-paper"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Explore
          </Link>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {gym.segment && (
                <p className="readout text-pool">{SEGMENT_LABELS[gym.segment]}</p>
              )}
              <h1 className="display mt-1.5 text-4xl text-paper sm:text-5xl">{gym.name}</h1>
              <p className="readout mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-mist">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {gym.neighborhood ?? "Tampa"}
                {gym.address && (
                  <>
                    <span className="opacity-40">·</span> {gym.address}
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="readout inline-flex items-center gap-1.5 rounded-md bg-blaze-deep px-3 py-2.5 text-white transition-colors hover:bg-blaze"
                >
                  <Navigation className="h-3 w-3" aria-hidden /> Directions
                </a>
              )}
              {gym.phone && (
                <a
                  href={`tel:${gym.phone}`}
                  className="readout inline-flex items-center gap-1.5 rounded-md border border-ink-line bg-ink-raise px-3 py-2.5 text-paper transition-colors hover:border-mist"
                >
                  <Phone className="h-3 w-3" aria-hidden /> Call
                </a>
              )}
              {gym.website && (
                <a
                  href={gym.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="readout inline-flex items-center gap-1.5 rounded-md border border-ink-line bg-ink-raise px-3 py-2.5 text-paper transition-colors hover:border-mist"
                >
                  Website <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
              <ShortlistButton gymId={gym.id} />
            </div>
          </div>

          {/* lead with what it HAS */}
          <div className="mt-6 flex flex-wrap gap-2">
            {gym.open_24h && (
              <span className="font-mono rounded-md bg-pool px-3 py-2 text-xs uppercase tracking-wide text-white">
                Open 24h
              </span>
            )}
            {highlights.map((key) => (
              <span
                key={key}
                className="font-mono rounded-md bg-ink-raise px-3 py-2 text-xs uppercase tracking-wide text-paper"
              >
                {key.replace(/_/g, " ")}
              </span>
            ))}
            {gym.day_pass_price !== null && (
              <span className="font-mono rounded-md border border-pool bg-pool/15 px-3 py-2 text-xs uppercase tracking-wide text-paper">
                Day pass ${Number(gym.day_pass_price).toFixed(0)}
              </span>
            )}
            {gym.rating !== null && (
              <span className="font-mono inline-flex items-center gap-1.5 rounded-md bg-ink-raise px-3 py-2 text-xs uppercase tracking-wide text-paper">
                <Star className="h-3.5 w-3.5 fill-pool text-pool" aria-hidden />
                {Number(gym.rating).toFixed(1)} ({gym.rating_count})
              </span>
            )}
          </div>

          {gym.description && (
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-mist">{gym.description}</p>
          )}
        </div>
      </section>

      {/* body */}
      <div className="survey-grid mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <AttributeSection title="Equipment" items={equipment} />
            <AttributeSection title="Recovery" items={byKeys(RECOVERY_KEYS)} />
            <AttributeSection title="Training & Classes" items={byKeys(TRAINING_KEYS)} />
            <AttributeSection title="Facility" items={facility} />
            {factCount <= 3 && (
              <div className="rounded-xl border border-dashed border-contour-deep/60 bg-paper-raise p-7 text-center">
                <span className="mx-auto inline-block text-contour">
                  <SignalPin size={48} variant="utility" />
                </span>
                <h2 className="display mt-3 text-lg text-ink">
                  Scout is still mapping this spot
                </h2>
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink/65">
                  Details are thin here for now. Know this place? Help Scout get
                  it right.
                </p>
                <a
                  href={`mailto:zchasse89@gmail.com?subject=${encodeURIComponent(`Scout data: ${gym.name}`)}&body=${encodeURIComponent("What should Scout know about this spot?")}`}
                  className="display mt-4 inline-block rounded-lg bg-ink px-4 py-2.5 text-sm tracking-wider text-paper transition-colors hover:bg-ink-raise"
                >
                  Suggest an update
                </a>
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <HoursDisplay hours={gym.hours} />
            <GymMiniMap gym={gym} />
            <div className="rounded-xl border border-paper-line bg-paper-raise p-5">
              <h2 className="readout text-ink/70">About this data</h2>
              <p className="font-mono mt-2.5 text-[10.5px] uppercase tracking-wide text-ink/75">
                Status: {gym.verified ? "Scout-verified" : "Unverified · curated research"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink/70">
                Every fact carries its source. <b>Scout Data</b> comes from our curated
                research; <b>Estimated</b> entries are conservative inferences, clearly
                labeled. Owner verification and user confirmations upgrade facts over time.
              </p>
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="mt-10">
            <h2 className="display text-xl text-ink">
              Similar {gym.segment ? SEGMENT_LABELS[gym.segment].toLowerCase() : ""} spots
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((g) => (
                <GymCard key={g.id} gym={g} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
