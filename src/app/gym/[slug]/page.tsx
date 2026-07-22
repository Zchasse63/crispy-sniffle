import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, AtSign, Clock, ExternalLink, MapPin, Navigation, Phone, Star } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import {
  fetchGymBySlug,
  fetchSimilarGyms,
  fetchCityPriceFields,
  fetchGymPhotos,
  type GymPhoto,
} from "@/lib/queries/gyms";
import {
  AMENITY_LABELS,
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
  instagramUrl,
  type AmenityKey,
  type EnrichedGym,
  type ScoredGym,
} from "@/lib/types/scout";
import { AttributeSection, type AttributeItem } from "@/components/gym/AttributeSection";
import { AskScout } from "@/components/gym/AskScout";
import { HoursDisplay } from "@/components/gym/HoursDisplay";
import { ParkingCard } from "@/components/gym/ParkingCard";
import { DropInCard } from "@/components/gym/DropInCard";
import { GymMiniMap, staticMapUrl } from "@/components/gym/GymMiniMap";
import { TrainHereButton } from "@/components/gym/TrainHereButton";
import { AccessBadge } from "@/components/gym/AccessBadge";
import { ShareButton } from "@/components/gym/ShareButton";
import { GymDetailStickyBar } from "@/components/gym/GymDetailStickyBar";
import { CommunitySection } from "@/components/community/CommunitySection";
import { GymJsonLd } from "@/components/gym/GymJsonLd";
import { MatchContext } from "@/components/gym/MatchContext";
import { PhotoGallery } from "@/components/gym/PhotoGallery";
import { fetchCommunityLinks } from "@/lib/queries/community";
import { mailtoHref } from "@/lib/contactInfo";
import { computePriceBands, priceContext } from "@/lib/pricing/priceContext";
import { deriveAccessStatus, formatPrice } from "@/lib/access";
import { openStatus } from "@/lib/hours";
import { nowInZone } from "@/lib/tz";
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

// Permanent slug aliases — renamed gyms keep their old URLs working (the page
// redirects them to the current slug). Old inbound links / SEO don't break.
const SLUG_ALIASES: Record<string, string> = {
  "cigar-city-crossfit": "noeql-training-co",
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
  const gym = await fetchGymBySlug(client, SLUG_ALIASES[slug] ?? slug);
  if (!gym) return { title: "Gym not found — Scout" };
  // Never fabricate a location: only name the neighborhood when we actually have
  // one (metadata runs before the city is fetched, so there's no city name here).
  const locationPhrase = gym.neighborhood ? ` in ${gym.neighborhood}` : "";
  const fallbackDescription = `${gym.name}${locationPhrase} on Scout.`;
  const description =
    gym.description?.split(". ")[0]?.slice(0, 155) ?? fallbackDescription;
  // social card: real facility photo when we have one, else branded map
  const ogImage =
    gym.photo_url ??
    (gym.lat !== null && gym.lng !== null
      ? staticMapUrl(gym.lng, gym.lat, { width: 1200, height: 630, zoom: 13.2 })
      : null);
  return {
    title: `${gym.name} — Scout`,
    description: gym.description ?? fallbackDescription,
    openGraph: {
      title: `${gym.name} — Scout`,
      description,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${gym.name} — Scout`,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
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
  // Renamed gyms keep their old URLs working — a permanent (308) redirect so search
  // engines consolidate the old slug's ranking onto the live one.
  const aliased = SLUG_ALIASES[slug];
  if (aliased) permanentRedirect(`/gym/${aliased}`);
  const client = await getServerClient();
  const gym = await fetchGymBySlug(client, slug);
  if (!gym) notFound();
  // Closed / relocated / deduped listings are delisted from browse — don't serve
  // them as live detail pages (or advertise them via the sitemap) either.
  if (gym.status === "closed" || gym.status === "moved" || gym.status === "duplicate") notFound();
  // Everything here needs only `gym`, so fetch it in ONE parallel wave rather than
  // sequential round-trips — each request holds a DB connection for less time,
  // which is what actually caps concurrency under load. (`similar` depends on the
  // resolved city, so it stays a second wave below.)
  const [cityRes, photos, communityLinks, countRes] = await Promise.all([
    client.from("cities").select("slug, name, state, is_live").eq("id", gym.city_id).maybeSingle(),
    fetchGymPhotos(client, gym.id),
    fetchCommunityLinks(client, gym.slug),
    client.rpc("confirmation_counts", { gym: gym.id }),
  ]);
  const city = cityRes.data;
  // Gyms in non-live cities are placeholder/seed listings — don't serve them as
  // public detail pages (they're also excluded from browse, sitemap, and trips).
  if (!city || !city.is_live) notFound();
  const countRows = countRes.data;

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

  // Lead with the best photo (the results thumbnail), then the gym's own gallery,
  // deduped by url — one expandable showcase instead of a faded backdrop + tiny strip.
  const gallery: GymPhoto[] = [];
  const seenPhotoUrls = new Set<string>();
  if (gym.photo_url) {
    gallery.push({ id: "hero", url: gym.photo_url, subject: null });
    seenPhotoUrls.add(gym.photo_url);
  }
  for (const p of photos) {
    if (!seenPhotoUrls.has(p.url)) {
      gallery.push(p);
      seenPhotoUrls.add(p.url);
    }
  }
  // community fact-confirmation counts (fetched in the parallel wave above).
  // price/hours carry last_confirmed_at too (single-key facts: 'day_pass' and
  // 'hours' — never per-day / per-plan) so HoursDisplay/DropInCard can render
  // "confirmed by a member {time}" alongside the count.
  const confirmCounts: {
    amenity: Record<string, number>;
    equipment: Record<string, number>;
    price: Record<string, { confirms: number; lastConfirmedAt: string | null }>;
    hours: Record<string, { confirms: number; lastConfirmedAt: string | null }>;
  } = { amenity: {}, equipment: {}, price: {}, hours: {} };
  for (const r of countRows ?? []) {
    if (r.fact_type === "amenity") confirmCounts.amenity[r.fact_key] = Number(r.confirms);
    else if (r.fact_type === "equipment") confirmCounts.equipment[r.fact_key] = Number(r.confirms);
    else if (r.fact_type === "price") {
      confirmCounts.price[r.fact_key] = { confirms: Number(r.confirms), lastConfirmedAt: r.last_confirmed_at };
    } else if (r.fact_type === "hours") {
      confirmCounts.hours[r.fact_key] = { confirms: Number(r.confirms), lastConfirmedAt: r.last_confirmed_at };
    }
  }
  const hoursConfirm = confirmCounts.hours.hours ?? null;
  const dayPassConfirm = confirmCounts.price.day_pass ?? null;
  // Weekly counter for the About-this-data card — a zero counter reads worse
  // than none (never-fabricate-adjacent honesty), so it's gated to N > 0.
  const confirmsThisWeek = (countRows ?? []).reduce((sum, r) => sum + Number(r.confirms_7d ?? 0), 0);

  // similar gyms: same segment, same city (targeted query — not full-city fetch)
  const [similarRows, cityPriceFields] = await Promise.all([
    fetchSimilarGyms(client, gym, 5),
    fetchCityPriceFields(client, gym.city_id),
  ]);
  const similar: ScoredGym[] = similarRows.map((g) => ({
    ...g,
    matchScore: null,
    matchReasons: [],
    missingItems: [],
  }));

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

  // "How do I get in?" status for the identity strip AND the sticky bar's
  // price line — one deterministic derivation (lib/access.ts), never forked.
  const accessStatus = deriveAccessStatus(gym);
  const priceLine =
    gym.day_pass_price !== null
      ? `Day pass $${formatPrice(Number(gym.day_pass_price))}`
      : accessStatus.derivable
        ? accessStatus.label
        : null;
  // Open-now status computed server-side, same convention as GymCard/
  // HoursDisplay (lib/hours.ts openStatus, built on scorer.ts isOpenNow) —
  // this page is a Server Component with no client "now" of its own, and
  // `force-dynamic` means this runs fresh per request rather than being
  // cached at build/deploy time.
  const openNow = openStatus(gym.hours, nowInZone(gym.timezone));

  return (
    // Bottom padding mirrors StickyActionBar's exported
    // STICKY_ACTION_BAR_PAGE_PADDING_CLASS ("pb-28") — can't import that
    // constant directly here since StickyActionBar is a "use client" module
    // and this page is a Server Component (RSC client-reference boundaries
    // only resolve component exports, not plain value exports). Reserved
    // only below `lg`, where the docked bar can actually appear.
    <main id="main-content" tabIndex={-1} className="flex-1 pb-28 lg:pb-0">
      <GymJsonLd gym={gym} cityName={city?.name ?? null} cityState={city?.state ?? null} />
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
                {gym.neighborhood ?? city.name}
                {gym.address && (
                  <>
                    <span className="opacity-40">·</span> {gym.address}
                  </>
                )}
              </p>
              {/* identity strip — access · open-now, scannable without scrolling
                  past the hero (audit finding: this info was buried 4-6 screens
                  deep on mobile). Segment/neighborhood already render in the
                  eyebrow and location line — repeating them here was noise. */}
              <div className="readout mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-mist">
                <AccessBadge gym={gym} context="detail" />
                {openNow && (
                  <>
                    <span className="opacity-40">·</span>
                    <span
                      className={`inline-flex items-center gap-1 ${
                        openNow.closingSoon
                          ? "font-semibold text-blaze"
                          : openNow.open
                            ? "text-pool"
                            : "text-mist"
                      }`}
                    >
                      <Clock className="h-3 w-3" aria-hidden />
                      {openNow.label}
                    </span>
                  </>
                )}
              </div>
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
              <ShareButton title={gym.name} url={`https://scout-gym.netlify.app/gym/${gym.slug}`} />
              {instagramUrl(gym.instagram) && (
                <a
                  href={instagramUrl(gym.instagram)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="readout inline-flex items-center gap-1.5 rounded-md border border-ink-line bg-ink-raise px-3 py-2.5 text-paper transition-colors hover:border-mist"
                >
                  <AtSign className="h-3 w-3" aria-hidden /> Instagram
                </a>
              )}
              <ShortlistButton gymId={gym.id} citySlug={city.slug} />
            <TrainHereButton gymId={gym.id} />
            </div>
          </div>

          <MatchContext gym={gym} />

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
            {/* day-pass chip removed — the AccessBadge in the identity strip now
                carries price + entry policy in one place (was triple-rendered) */}
            {gym.rating !== null && (
              <span
                className="font-mono inline-flex items-center gap-1.5 rounded-md bg-ink-raise px-3 py-2 text-xs uppercase tracking-wide text-paper"
                title={
                  gym.rating_is_seed
                    ? "Aggregated public web rating from our research — Scout community reviews are just launching"
                    : "Scout community rating"
                }
              >
                <Star className="h-3.5 w-3.5 fill-pool text-pool" aria-hidden />
                {Number(gym.rating).toFixed(1)} ({gym.rating_count})
                {gym.rating_is_seed && <span className="text-[9px] text-mist/80">· web</span>}
              </span>
            )}
          </div>

          {gym.description && (
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-mist">{gym.description}</p>
          )}
        </div>
      </section>

      <GymDetailStickyBar
        name={gym.name}
        priceLine={priceLine}
        directionsHref={directionsUrl}
        gymId={gym.id}
        citySlug={city.slug}
      />

      {/* photos — prominent, expandable gallery (was a faded backdrop + tiny strip) */}
      {gallery.length > 0 && <PhotoGallery photos={gallery} gymName={gym.name} />}

      {/* body */}
      <div className="survey-grid mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main column. Mobile: `order-2` sits it between the hoisted Hours/
              Getting-in/Parking block below and the map/about-data block —
              equipment facts no longer bury those above the fold (audit #2).
              Desktop: `lg:order-1` puts it back in the left 1fr column. */}
          <div className="order-2 space-y-5 lg:order-1">
            <AttributeSection
              title="Equipment"
              items={equipment}
              gymId={gym.id}
              factType="equipment"
              confirmCounts={confirmCounts.equipment}
            />
            <AttributeSection
              title="Recovery"
              items={byKeys(RECOVERY_KEYS)}
              gymId={gym.id}
              factType="amenity"
              confirmCounts={confirmCounts.amenity}
            />
            <AttributeSection
              title="Training & Classes"
              items={byKeys(TRAINING_KEYS)}
              gymId={gym.id}
              factType="amenity"
              confirmCounts={confirmCounts.amenity}
            />
            <AttributeSection
              title="Facility"
              items={facility}
              gymId={gym.id}
              factType="amenity"
              confirmCounts={confirmCounts.amenity}
            />
            <AskScout gym={gym} />
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
                  href={mailtoHref(
                    `Scout data: ${gym.name}`,
                    "What should Scout know about this spot?",
                  )}
                  className="display mt-4 inline-block rounded-lg bg-ink px-4 py-2.5 text-sm tracking-wider text-paper transition-colors hover:bg-ink-raise"
                >
                  Suggest an update
                </a>
              </div>
            )}
            <CommunitySection gymId={gym.id} gymName={gym.name} links={communityLinks} />
          </div>

          {/* Aside, split for the mobile reorder. `contents` dissolves this
              wrapper's own box below `lg` so its two children become direct
              items of the outer grid (positioned by `order` alongside the
              main column above); at `lg`+ it becomes a real flex column again
              — one 320px right-hand aside, same as before the split. */}
          <div className="contents lg:order-2 lg:flex lg:w-[320px] lg:shrink-0 lg:flex-col lg:gap-5">
            {/* Hoisted on mobile: `order-1` puts Hours/Getting-in/Parking
                directly after the hero, ahead of the equipment sections. */}
            <div className="order-1 space-y-5">
              <HoursDisplay
                gymId={gym.id}
                hours={gym.hours}
                timezone={gym.timezone}
                hoursVerifiedAt={gym.hours_verified_at}
                ownerVerified={gym.verified || gym.owner_listed}
                confirms={hoursConfirm?.confirms ?? 0}
                lastConfirmedAt={hoursConfirm?.lastConfirmedAt ?? null}
              />
              <DropInCard
                gym={gym}
                confirms={dayPassConfirm?.confirms ?? 0}
                lastConfirmedAt={dayPassConfirm?.lastConfirmedAt ?? null}
                priceCtx={priceContext(
                  gym,
                  computePriceBands(cityPriceFields, city?.name ?? "this city"),
                )}
              />
              <ParkingCard parking={gym.parking} transit={gym.transit} />
            </div>
            <div className="order-3 space-y-5">
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
                {confirmsThisWeek > 0 && (
                  <p className="font-mono mt-2 text-[10.5px] uppercase tracking-wide text-pool-deep">
                    {confirmsThisWeek} fact{confirmsThisWeek === 1 ? "" : "s"} confirmed this week
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>


        {similar.length > 0 && (
          <section className="mt-10">
            <h2 className="display text-xl text-ink">
              Similar {gym.segment ? SEGMENT_LABELS[gym.segment].toLowerCase() : ""} spots
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((g) => (
                <GymCard key={g.id} gym={g} citySlug={city.slug} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
