import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Star } from "lucide-react";
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

  return (
    <div className="flex-1">
      {/* hero */}
      <section className="survey-grid-night bg-ink-deep">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
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
            <div className="flex items-center gap-3">
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

          {/* quick facts */}
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="font-mono rounded-md bg-ink-raise px-3 py-2 text-xs uppercase tracking-wide text-paper">
              {gym.day_pass_price !== null
                ? `Day pass $${Number(gym.day_pass_price).toFixed(0)}`
                : "Day-pass price unlisted"}
            </span>
            {gym.open_24h && (
              <span className="font-mono rounded-md bg-pool px-3 py-2 text-xs uppercase tracking-wide text-white">
                Open 24h
              </span>
            )}
            {gym.rating !== null && (
              <span className="font-mono inline-flex items-center gap-1.5 rounded-md bg-ink-raise px-3 py-2 text-xs uppercase tracking-wide text-paper">
                <Star className="h-3.5 w-3.5 fill-pool text-pool" aria-hidden />
                {Number(gym.rating).toFixed(1)} ({gym.rating_count})
              </span>
            )}
            <span className="font-mono rounded-md border border-ink-line px-3 py-2 text-xs uppercase tracking-wide text-mist">
              {gym.verified ? "Scout-verified" : "Unverified · seed data"}
            </span>
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
            {equipment.length === 0 &&
              gym.amenities.length === 0 && (
                <div className="rounded-xl border border-dashed border-contour bg-paper-raise p-8 text-center">
                  <span className="mx-auto inline-block text-contour">
                    <SignalPin size={48} variant="utility" />
                  </span>
                  <p className="mt-3 text-sm text-ink/60">
                    Scout hasn&apos;t mapped this gym&apos;s details yet.
                  </p>
                </div>
              )}
          </div>

          <aside className="space-y-5">
            <HoursDisplay hours={gym.hours} />
            <GymMiniMap gym={gym} />
            <div className="rounded-xl border border-paper-line bg-paper-raise p-5">
              <h2 className="readout text-ink/50">About this data</h2>
              <p className="mt-2.5 text-xs leading-relaxed text-ink/70">
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
