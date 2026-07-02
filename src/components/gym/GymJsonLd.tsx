import type { EnrichedGym } from "@/lib/types/scout";
import { instagramUrl } from "@/lib/types/scout";

/** schema.org ExerciseGym structured data — search + AI answer engines.
 *  Payload is built ONLY from our own typed fields; "<" is escaped to
 *  < so scraped description text can never break out of the tag. */
export function GymJsonLd({
  gym,
  cityName,
  cityState,
}: {
  gym: EnrichedGym;
  cityName?: string | null;
  cityState?: string | null;
}) {
  // Entity-linking: associate the gym with its website + social profiles.
  const sameAs = [gym.website, instagramUrl(gym.instagram)].filter(Boolean) as string[];
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ExerciseGym",
    name: gym.name,
    url: `https://scout-gym.netlify.app/gym/${gym.slug}`,
    ...(gym.description ? { description: gym.description } : {}),
    ...(gym.photo_url ? { image: gym.photo_url } : {}),
    ...(gym.phone ? { telephone: gym.phone } : {}),
    ...(sameAs.length ? { sameAs: sameAs.length === 1 ? sameAs[0] : sameAs } : {}),
    ...(gym.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: gym.address,
            // gyms span multiple metros now — use the real city, omit if unknown
            ...(cityName ? { addressLocality: cityName } : {}),
            ...(cityState ? { addressRegion: cityState } : {}),
            addressCountry: "US",
          },
        }
      : {}),
    ...(gym.lat !== null && gym.lng !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: gym.lat, longitude: gym.lng } }
      : {}),
    ...(gym.day_pass_price !== null
      ? {
          offers: {
            "@type": "Offer",
            name: "Day pass",
            price: Number(gym.day_pass_price).toFixed(2),
            priceCurrency: "USD",
          },
        }
      : {}),
    // Only OUR OWN reviews may be published as aggregateRating — a seeded
    // third-party web rating must not masquerade as first-party Scout data
    // (Google requires site-sourced aggregateRating; misuse risks manual action).
    ...(gym.rating !== null && gym.rating_count > 0 && !gym.rating_is_seed
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(gym.rating).toFixed(1),
            reviewCount: gym.rating_count,
          },
        }
      : {}),
    // Only explicitly-stated amenities become machine-readable facts. Estimated
    // inferences (≤0.7, badged in the UI) must not be asserted as ground truth.
    ...(gym.amenities.some((a) => a.present && a.source !== "estimated")
      ? {
          amenityFeature: gym.amenities
            .filter((a) => a.present && a.source !== "estimated")
            .slice(0, 12)
            .map((a) => ({
              "@type": "LocationFeatureSpecification",
              name: a.amenity_key.replace(/_/g, " "),
              value: true,
            })),
        }
      : {}),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
